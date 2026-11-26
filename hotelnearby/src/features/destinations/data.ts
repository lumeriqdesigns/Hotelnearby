/** Geographic reference data for Nigeria. Counts/content are deliberately not fabricated. */
export type NigerianState = { name: string; slug: string; capital: string; region: string };
export type LaunchTown = { name: string; slug: string; state: string; status: "upcoming" | "published"; summary?: string };

export const NIGERIA = { name: "Nigeria", slug: "nigeria", code: "NG" } as const;

export const NIGERIAN_STATES: NigerianState[] = [
  { name: "Abia", slug: "abia", capital: "Umuahia", region: "South East" },
  { name: "Adamawa", slug: "adamawa", capital: "Yola", region: "North East" },
  { name: "Akwa Ibom", slug: "akwa-ibom", capital: "Uyo", region: "South South" },
  { name: "Anambra", slug: "anambra", capital: "Awka", region: "South East" },
  { name: "Bauchi", slug: "bauchi", capital: "Bauchi", region: "North East" },
  { name: "Bayelsa", slug: "bayelsa", capital: "Yenagoa", region: "South South" },
  { name: "Benue", slug: "benue", capital: "Makurdi", region: "North Central" },
  { name: "Borno", slug: "borno", capital: "Maiduguri", region: "North East" },
  { name: "Cross River", slug: "cross-river", capital: "Calabar", region: "South South" },
  { name: "Delta", slug: "delta", capital: "Asaba", region: "South South" },
  { name: "Ebonyi", slug: "ebonyi", capital: "Abakaliki", region: "South East" },
  { name: "Edo", slug: "edo", capital: "Benin City", region: "South South" },
  { name: "Ekiti", slug: "ekiti", capital: "Ado-Ekiti", region: "South West" },
  { name: "Enugu", slug: "enugu", capital: "Enugu", region: "South East" },
  { name: "Gombe", slug: "gombe", capital: "Gombe", region: "North East" },
  { name: "Imo", slug: "imo", capital: "Owerri", region: "South East" },
  { name: "Jigawa", slug: "jigawa", capital: "Dutse", region: "North West" },
  { name: "Kaduna", slug: "kaduna", capital: "Kaduna", region: "North West" },
  { name: "Kano", slug: "kano", capital: "Kano", region: "North West" },
  { name: "Katsina", slug: "katsina", capital: "Katsina", region: "North West" },
  { name: "Kebbi", slug: "kebbi", capital: "Birnin Kebbi", region: "North West" },
  { name: "Kogi", slug: "kogi", capital: "Lokoja", region: "North Central" },
  { name: "Kwara", slug: "kwara", capital: "Ilorin", region: "North Central" },
  { name: "Lagos", slug: "lagos", capital: "Ikeja", region: "South West" },
  { name: "Nasarawa", slug: "nasarawa", capital: "Lafia", region: "North Central" },
  { name: "Niger", slug: "niger", capital: "Minna", region: "North Central" },
  { name: "Ogun", slug: "ogun", capital: "Abeokuta", region: "South West" },
  { name: "Ondo", slug: "ondo", capital: "Akure", region: "South West" },
  { name: "Osun", slug: "osun", capital: "Osogbo", region: "South West" },
  { name: "Oyo", slug: "oyo", capital: "Ibadan", region: "South West" },
  { name: "Plateau", slug: "plateau", capital: "Jos", region: "North Central" },
  { name: "Rivers", slug: "rivers", capital: "Port Harcourt", region: "South South" },
  { name: "Sokoto", slug: "sokoto", capital: "Sokoto", region: "North West" },
  { name: "Taraba", slug: "taraba", capital: "Jalingo", region: "North East" },
  { name: "Yobe", slug: "yobe", capital: "Damaturu", region: "North East" },
  { name: "Zamfara", slug: "zamfara", capital: "Gusau", region: "North West" },
  { name: "Federal Capital Territory", slug: "fct", capital: "Abuja", region: "North Central" },
];

export const LAUNCH_TOWNS: LaunchTown[] = [
  { name: "Ilorin", slug: "ilorin", state: "Kwara", status: "upcoming" },
  { name: "Offa", slug: "offa", state: "Kwara", status: "upcoming" },
  { name: "Omu-Aran", slug: "omu-aran", state: "Kwara", status: "upcoming" },
  { name: "Jebba", slug: "jebba", state: "Kwara", status: "upcoming" },
  { name: "Lafiagi", slug: "lafiagi", state: "Kwara", status: "upcoming" },
  { name: "Patigi", slug: "patigi", state: "Kwara", status: "upcoming" },
  { name: "Kaiama", slug: "kaiama", state: "Kwara", status: "upcoming" },
  { name: "Osi", slug: "osi", state: "Kwara", status: "upcoming" },
  { name: "Igbaja", slug: "igbaja", state: "Kwara", status: "upcoming" },
  { name: "Share", slug: "share", state: "Kwara", status: "upcoming" },
];

export const LOCATION_LEVELS = ["country", "state", "city_town", "neighbourhood", "landmark"] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];

export function getStateBySlug(slug: string) {
  return NIGERIAN_STATES.find((state) => state.slug === slug);
}

export function getTownBySlug(slug: string) {
  return LAUNCH_TOWNS.find((town) => town.slug === slug);
}

export function stateNameFromSlug(slug: string) {
  return getStateBySlug(slug)?.name;
}

export function getTownsForState(stateName: string) {
  return LAUNCH_TOWNS.filter((town) => town.state.toLowerCase() === stateName.toLowerCase());
}
