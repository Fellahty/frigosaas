import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  query,
  getDocs,
  where,
  Timestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useTenantId } from "../../lib/hooks/useTenantId";
import { RoomSummary } from "../../types/metrics";
import { safeToDate } from "../../lib/dateUtils";

interface Reservation {
  id: string;
  clientId: string;
  clientName: string;
  reservedCrates: number;
  selectedRooms: string[];
  status: "REQUESTED" | "APPROVED" | "CLOSED" | "REFUSED";
}

interface FacilityMapProps {
  rooms?: RoomSummary[];
  receptions?: any[];
  clients?: any[];
}

interface Reception {
  id: string;
  serial: string;
  clientId: string;
  clientName: string;
  truckId: string;
  truckNumber: string;
  driverId: string;
  driverName: string;
  productId: string;
  productName: string;
  productVariety: string;
  roomId?: string;
  roomName?: string;
  totalCrates: number;
  arrivalTime: any;
  status: "pending" | "in_progress" | "completed";
  notes?: string;
  createdAt: any;
}

// Helper function to get color based on occupancy
const getBatteryConfig = (percentage: number) => {
  if (percentage === 0) {
    return { color: "bg-gray-400" };
  } else if (percentage < 60) {
    return { color: "bg-green-500" };
  } else if (percentage < 80) {
    return { color: "bg-yellow-500" };
  } else {
    return { color: "bg-red-500" };
  }
};

// Simplified Room Card Component
const RoomCard: React.FC<{
  room: RoomSummary;
  clients: any[];
  reservations: Reservation[];
  viewMode: "reservations" | "real-entries";
  receptions: Reception[];
}> = ({ room, clients, reservations, viewMode, receptions }) => {
  const { t } = useTranslation();

  const occupancyPercentage = Math.round(
    (room.currentOccupancy / room.capacity) * 100
  );
  const batteryConfig = getBatteryConfig(occupancyPercentage);
  const roomClients = clients || [];

  // Get reservations for this room
  const roomReservations = reservations.filter(
    (reservation) =>
      reservation.selectedRooms && reservation.selectedRooms.includes(room.id)
  );

  // Get receptions for this room
  const roomReceptions = receptions.filter((reception) => {
    const matches = reception.roomId === room.id;
    if (matches) {
      console.log(
        `✅ Reception ${reception.id} matches room ${room.id} (${room.name})`
      );
    }
    return matches;
  });

  // Debug logging
  if (receptions.length > 0) {
    console.log(
      `Room ${room.id} (${room.name}): Found ${roomReceptions.length} receptions out of ${receptions.length} total`
    );
    receptions.forEach((reception) => {
      console.log(
        `Reception ${reception.id}: roomId=${reception.roomId}, roomName=${reception.roomName}, client=${reception.clientName}`
      );
    });
  }

  // Calculate total reserved crates for this room (distributed among selected rooms)
  const totalReservedCrates = roomReservations.reduce((total, reservation) => {
    // Distribute reserved crates among all selected rooms
    const distributedCrates =
      reservation.reservedCrates / (reservation.selectedRooms?.length || 1);
    return total + distributedCrates;
  }, 0);

  // Calculate reservation percentage based on room capacity
  const reservationPercentage =
    room.capacity > 0
      ? Math.round((totalReservedCrates / room.capacity) * 100)
      : 0;

  // Calculate cumulative entries for this room
  const cumulativeEntries = roomReceptions.length;
  const cumulativeCrates = roomReceptions.reduce(
    (total, reception) => total + reception.totalCrates,
    0
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Room Header */}
      <div
        className={`h-10 ${batteryConfig.color} flex items-center justify-center`}
      >
        <div className="text-center text-white">
          <div className="font-semibold text-sm">{room.name}</div>
        </div>
      </div>

      {/* Room Content */}
      <div className="p-4">
        {/* Occupancy Info */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {room.currentOccupancy}<span className="text-gray-400 text-lg">/{room.capacity}</span>
            </div>
            <div className="text-xs text-gray-500">
              {t("dashboard.facilityMap.crates", "caisses")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-700">
              {occupancyPercentage}%
            </div>
            <div className="text-xs text-gray-500">{t("dashboard.available", "disponible")}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 ${batteryConfig.color} rounded-full transition-all duration-500`}
              style={{ width: `${occupancyPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Dynamic Content Section based on View Mode */}
        <div className="border-t border-gray-100 pt-3">
          {viewMode === "reservations" ? (
            // Reservations View
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">
                  {t("dashboard.facilityMap.reservations", "Réservations")}
                </span>
                <span className="text-xs font-semibold text-blue-600">
                  {Math.round(totalReservedCrates)} {t("dashboard.facilityMap.crates", "caisses")}
                </span>
              </div>

              {roomReservations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roomReservations
                    .slice(0, 3)
                    .map((reservation: Reservation) => (
                      <div
                        key={reservation.id}
                        className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium"
                        title={`${reservation.clientName} - ${Math.round(
                          reservation.reservedCrates /
                            reservation.selectedRooms.length
                        )} ${t("dashboard.facilityMap.crates")}`}
                      >
                        {reservation.clientName
                          ? reservation.clientName.substring(0, 12)
                          : "Client"}
                      </div>
                    ))}
                  {roomReservations.length > 3 && (
                    <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium">
                      +{roomReservations.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-xs text-gray-400">
                    {t("dashboard.facilityMap.noReservations", {
                      default: "Aucune réservation",
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Real Entries/Exits View - Only entrée de caisse and client data
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-600">
                  {t("dashboard.facilityMap.appleEntries", "Entrées Pommiers")}
                </span>
                <span className="text-xs font-semibold text-green-600">
                  {roomReceptions.length} {t("dashboard.facilityMap.entries", "entrées")} ({cumulativeCrates})
                </span>
              </div>

              {roomReceptions.length > 0 ? (
                <div className="space-y-2">
                  {roomReceptions.slice(0, 3).map((reception: Reception) => {
                    const entryDate = safeToDate(reception.createdAt) || new Date();
                    const displayName = reception.clientName || "Client inconnu";

                    return (
                      <div
                        key={reception.id}
                        className="flex items-center justify-between p-2 bg-green-50 rounded-lg"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-gray-700 font-medium text-xs truncate">
                            {displayName}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {reception.totalCrates} {t("dashboard.facilityMap.crates")}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {entryDate.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {roomReceptions.length > 3 && (
                    <div className="text-center py-1 text-xs text-gray-500">
                      +{roomReceptions.length - 3} autres
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-xs text-gray-400">Aucune réception</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FacilityMap: React.FC<FacilityMapProps> = ({
  rooms = [],
  clients = [],
}) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [group1, setGroup1] = useState<RoomSummary[]>([]);
  const [group2, setGroup2] = useState<RoomSummary[]>([]);
  const [activeTab, setActiveTab] = useState<"group1" | "group2">("group1");
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"reservations" | "real-entries">(
    "reservations"
  );

  // Fetch real apple receptions from Firebase
  const { data: receptions = [] } = useQuery({
    queryKey: ["receptions-dashboard", tenantId],
    queryFn: async (): Promise<Reception[]> => {
      // Get all receptions for this tenant
      const q = query(
        collection(db, "receptions"),
        where("tenantId", "==", tenantId)
      );
      const snapshot = await getDocs(q);

      // Filter by date in JavaScript to avoid index requirement
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allReceptions = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Reception)
        )
        .filter((reception) => {
          const createdAt = reception.createdAt?.toDate
            ? reception.createdAt.toDate()
            : new Date(reception.createdAt);
          return createdAt >= sevenDaysAgo;
        });

      console.log("Found apple receptions:", allReceptions.length);
      console.log("Apple receptions data:", allReceptions);

      // Log each reception in detail
      allReceptions.forEach((reception, index) => {
        console.log(`Reception ${index + 1}:`, {
          id: reception.id,
          serial: reception.serial,
          clientId: reception.clientId,
          clientName: reception.clientName,
          productName: reception.productName,
          productVariety: reception.productVariety,
          totalCrates: reception.totalCrates,
          roomName: reception.roomName,
          createdAt: reception.createdAt,
          arrivalTime: reception.arrivalTime,
          status: reception.status,
        });
      });

      return allReceptions;
    },
    enabled: !!tenantId,
  });

  // Fetch reservations data
  const { data: reservations = [] } = useQuery({
    queryKey: ["reservations", tenantId],
    queryFn: async (): Promise<Reservation[]> => {
      if (!tenantId) return [];

      const reservationsQuery = query(
        collection(db, "tenants", tenantId, "reservations"),
        where("status", "in", ["APPROVED", "REQUESTED"])
      );
      const snapshot = await getDocs(reservationsQuery);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          clientId: data.clientId || "",
          clientName: data.clientName || "",
          reservedCrates: data.reservedCrates || 0,
          selectedRooms: data.selectedRooms || [],
          status: data.status || "REQUESTED",
        };
      });
    },
    enabled: !!tenantId,
  });

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!rooms?.length) {
      setGroup1([]);
      setGroup2([]);
      return;
    }
  
    const getCHNumber = (name: string) => {
      const m = name.trim().match(/^(CH|chambre)\s*(\d+)/i);
      return m ? parseInt(m[2], 10) : null;
    };
  
    const getCouloirNumber = (name: string) => {
      const m = name.trim().match(/^Couloir\s*(\d+)/i);
      return m ? parseInt(m[1], 10) : null;
    };
  
    // Optional: stable sort -> CH by number, then Couloir by number, then name.
    const sortedRooms = [...rooms].sort((a, b) => {
      const aCH = getCHNumber(a.name);
      const bCH = getCHNumber(b.name);
      const aCou = getCouloirNumber(a.name);
      const bCou = getCouloirNumber(b.name);
  
      // CH first by number
      if (aCH !== null || bCH !== null) {
        if (aCH === null) return 1;
        if (bCH === null) return -1;
        return aCH - bCH;
      }
      // then Couloir by number
      if (aCou !== null || bCou !== null) {
        if (aCou === null) return 1;
        if (bCou === null) return -1;
        return aCou - bCou;
      }
      // fallback: alphabetical
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  
    const group1Rooms = sortedRooms.filter((room) => {
      const chNum = getCHNumber(room.name);
      const couNum = getCouloirNumber(room.name);
  
      // Explicit Couloir rules first
      if (couNum === 1) return true;
      if (couNum === 2) return false;
  
      // CH rule: 1–6 in Group 1 (change to 1–5 if that’s your real range)
      return chNum !== null && chNum >= 1 && chNum <= 6;
    });
  
    const group2Rooms = sortedRooms.filter((room) => {
      const chNum = getCHNumber(room.name);
      const couNum = getCouloirNumber(room.name);
  
      if (couNum === 2) return true;
      if (couNum === 1) return false;
  
      // CH rule: >6 in Group 2
      return chNum !== null && chNum > 6;
    });
  
    setGroup1(group1Rooms);
    setGroup2(group2Rooms);
  }, [rooms]);
  
  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && activeTab === "group1" && group2.length > 0) {
      setActiveTab("group2");
    }
    if (isRightSwipe && activeTab === "group2" && group1.length > 0) {
      setActiveTab("group1");
    }
  };

  // Helper function to get clients for a room (for direct entries)
  const getClientsForRoom = () => {
    // This would typically filter clients based on room reservations
    // For now, return a subset of clients as an example with realistic data
    return clients
      .filter(() => {
        // Simple example: return first few clients
        return Math.random() > 0.5;
      })
      .slice(0, 3)
      .map((client: any) => ({
        ...client,
        // Add realistic entry data
        entryDate: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ), // Random date within last 7 days
        entryType: "caisse",
        status: "active",
      }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Apple-style Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col space-y-4">
          {/* Mobile Header */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  {activeTab === "group1" ? "LYAZAMI 1-6" : "LYAZAMI 7-12"}
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  {activeTab === "group1"
                    ? `${group1.length} ${t(
                        "dashboard.facilityMap.roomsMain"
                      )} principales`
                    : `${group2.length} ${t(
                        "dashboard.facilityMap.roomsMain"
                      )} principales`}
                </p>
              </div>
              <div className="flex space-x-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activeTab === "group1" ? "bg-blue-500" : "bg-gray-300"
                  }`}
                ></div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    activeTab === "group2" ? "bg-green-500" : "bg-gray-300"
                  }`}
                ></div>
              </div>
            </div>
          </div>

          {/* Desktop Header - Removed titles for cleaner design */}
          <div className="hidden sm:block">
            {/* Titles removed for cleaner Apple-style design */}
          </div>

          {/* Simple Mobile Toggle Switch */}
          <div className="flex items-center justify-center">
            <div className="bg-gray-100 rounded-full p-1 flex">
              <button
                onClick={() => setViewMode("reservations")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  viewMode === "reservations"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t("dashboard.facilityMap.reservations", "Réservations")}
              </button>
              <button
                onClick={() => setViewMode("real-entries")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  viewMode === "real-entries"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t("dashboard.facilityMap.appleEntries", "Entrées Pommiers")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex-1 space-y-4 sm:space-y-6 lg:space-y-8 pb-20 sm:pb-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Group 1 - LYAZAMI 1-6 */}
        {group1.length > 0 && (activeTab === "group1" || !isMobile) && (
          <div
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
              isMobile
                ? activeTab === "group1"
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-full absolute"
                : ""
            }`}
          >
            {/* Desktop header - hidden on mobile */}
            <div className="hidden sm:block px-6 py-6 bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    LYAZAMI 1-6
                  </h2>
                  <p className="text-gray-600 text-sm font-medium">
                    {t(
                      "dashboard.facilityMap.roomsMain",
                      "chambres principales"
                    )}{" "}
                    (1-6)
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {group1.length}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">
                    {t(
                      "dashboard.facilityMap.roomsMain",
                      "chambres principales"
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-2 py-3 sm:px-4 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {group1.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    clients={getClientsForRoom()}
                    reservations={reservations}
                    viewMode={viewMode}
                    receptions={receptions}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Group 2 - LYAZAMI 7-12 */}
        {group2.length > 0 && (activeTab === "group2" || !isMobile) && (
          <div
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
              isMobile
                ? activeTab === "group2"
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-full absolute"
                : ""
            }`}
          >
            {/* Desktop header - hidden on mobile */}
            <div className="hidden sm:block px-6 py-6 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    LYAZAMI 7-12
                  </h2>
                  <p className="text-gray-600 text-sm font-medium">
                    {t(
                      "dashboard.facilityMap.roomsMain",
                      "chambres principales"
                    )}{" "}
                    (7-12)
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {group2.length}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">
                    {t(
                      "dashboard.facilityMap.roomsMain",
                      "chambres principales"
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-2 py-3 sm:px-4 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {group2.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    clients={getClientsForRoom()}
                    reservations={reservations}
                    viewMode={viewMode}
                    receptions={receptions}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {group1.length === 0 && group2.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t("dashboard.facilityMap.noRoomsAvailable", {
                default: "Aucune chambre disponible",
              })}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {t("dashboard.facilityMap.noRoomsDescription", {
                default: "Aucune chambre configurée pour cette installation",
              })}
            </p>
          </div>
        )}
      </div>

      {/* Mobile Tab Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg">
        <div className="flex">
          <button
            onClick={() => setActiveTab("group1")}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-4 transition-all duration-200 ${
              activeTab === "group1"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all duration-200 ${
                activeTab === "group1"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-xs font-medium">LYAZAMI 1-6</span>
            <span className="text-xs text-gray-400">
              {group1.length}{" "}
              {t("dashboard.facilityMap.roomsMain", "chambres principales")}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("group2")}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-4 transition-all duration-200 ${
              activeTab === "group2"
                ? "text-green-600 bg-green-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-all duration-200 ${
                activeTab === "group2"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <span className="text-xs font-medium">LYAZAMI 7-12</span>
            <span className="text-xs text-gray-400">
              {group2.length}{" "}
              {t("dashboard.facilityMap.roomsMain", "chambres principales")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacilityMap;
