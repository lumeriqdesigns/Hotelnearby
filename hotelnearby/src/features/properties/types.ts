export type PropertyMedia = {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail_url: string | null;
  alt: string;
  caption: string;
};

export type PropertyOffering = {
  id: string;
  name: string;
  description: string;
  price_amount: number | null;
  price_basis: string;
  guest_capacity: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: string[];
  price_updated_at: string | null;
};

export type SimilarProperty = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price_amount: number | null;
  price_basis: string | null;
  cover_image_url: string | null;
  city_name: string | null;
  state_name: string | null;
  verification_status: string;
};

export type PublicPropertyDetail = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  cover_image_url: string | null;
  address_line: string | null;
  latitude: number | null;
  longitude: number | null;
  price_amount: number | null;
  price_basis: string | null;
  price_updated_at: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guest_capacity: number | null;
  amenities: string[];
  features: string[];
  phone_number: string | null;
  whatsapp_number: string | null;
  contact_email: string | null;
  website_url: string | null;
  house_rules: string | null;
  check_in_information: string | null;
  check_out_information: string | null;
  verification_status: string;
  created_at: string;
  updated_at: string;
  state_name: string | null;
  city_name: string | null;
  neighbourhood_name: string | null;
  landmark_name: string | null;
  media: PropertyMedia[];
  room_categories: PropertyOffering[];
  apartment_units: PropertyOffering[];
  nearby_landmarks: { name: string; distance: string | null }[];
  similar_properties: SimilarProperty[];
};
