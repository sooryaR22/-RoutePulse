export const ROUTES = {
  nagercoil_kanyakumari: {
    id: "nagercoil_kanyakumari",

    name: "Nagercoil → Kanyakumari",

    demoSpeedMs: 4000,

    arrivalRadiusMeters: 100,

    stops: [
      {
        id: "nagercoil_vadasery",
        name: "Vadasery Bus Stand",
        latitude: 8.1834,
        longitude: 77.4119,
      },
      {
        id: "kottar",
        name: "Kottar",
        latitude: 8.1695,
        longitude: 77.4341,
      },
      {
        id: "suchindram",
        name: "Suchindram",
        latitude: 8.1545,
        longitude: 77.4671,
      },
      {
        id: "vazhukkamparai",
        name: "Vazhukkamparai",
        latitude: 8.1296,
        longitude: 77.4936,
      },
      {
        id: "kottaram",
        name: "Kottaram",
        latitude: 8.0887,
        longitude: 77.5336,
      },
      {
        id: "kanyakumari",
        name: "Kanyakumari Bus Stand",
        latitude: 8.0883,
        longitude: 77.5385,
      },
    ],
  },
};

export const DEFAULT_ROUTE_ID = "nagercoil_kanyakumari";

export function getRouteById(routeId) {
  return ROUTES[routeId] || null;
}