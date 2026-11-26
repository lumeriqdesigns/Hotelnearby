export const accommodationCategories = [
  { value: "hotel", label: "Hotels" },
  { value: "serviced-apartment", label: "Serviced apartments" },
  { value: "shortlet", label: "Shortlets" },
  { value: "guest-house", label: "Guest houses" },
  { value: "lodge", label: "Lodges" },
  { value: "resort", label: "Resorts" },
  { value: "boutique-stay", label: "Boutique stays" },
  { value: "hostel", label: "Hostels" },
  { value: "villa", label: "Villas" },
  { value: "holiday-home", label: "Holiday homes" },
] as const;

export const amenityOptions = [
  ["wifi", "Wi-Fi"], ["air-conditioning", "Air conditioning"], ["swimming-pool", "Swimming pool"],
  ["parking", "Parking"], ["restaurant", "Restaurant"], ["bar", "Bar"],
  ["gym", "Gym"], ["kitchen", "Kitchen"], ["laundry", "Laundry"],
  ["workspace", "Workspace"], ["room-service", "Room service"], ["tv", "Television"],
] as const;

export const featureOptions = [
  ["family-friendly", "Family-friendly"], ["accessible", "Accessible facilities"],
  ["24-hour-security", "24-hour security"], ["backup-power", "Backup power"],
  ["pet-friendly", "Pet-friendly"], ["waterfront", "Waterfront"],
  ["event-space", "Event space"], ["self-check-in", "Self check-in"],
] as const;

export type SearchFilters = {
  query: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guests: number | null;
  amenities: string[];
  features: string[];
  verification: string;
  sort: string;
  page: number;
};

export type PropertySearchResult = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price_amount: number | null;
  price_basis: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guest_capacity: number | null;
  amenities: string[];
  features: string[];
  cover_image_url: string | null;
  verification_status: string;
  created_at: string;
  updated_at: string;
  state_name: string | null;
  city_name: string | null;
  neighbourhood_name: string | null;
  landmark_name: string | null;
  total_count: number;
};
