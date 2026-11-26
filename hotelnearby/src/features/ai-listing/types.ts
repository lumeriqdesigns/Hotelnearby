export const listingCategories = [
  "hotel", "serviced-apartment", "shortlet", "guest-house", "lodge",
  "resort", "boutique-stay", "hostel", "villa", "holiday-home",
] as const;

export type ListingCategory = (typeof listingCategories)[number];

export type ListingGuideSuggestions = {
  suggestedCategory: ListingCategory | null;
  categoryReason: string;
  descriptionDraft: string;
  locationQuestions: string[];
  roomOrUnitGuidance: string[];
  pricingBasisExplanation: string;
  suggestedAmenities: string[];
  photoGuidance: string[];
  houseRulesDraft: string;
  missingFacts: string[];
  nextQuestion: string;
  nextQuestionOptions: string[];
  completenessChecklist: { label: string; status: "provided" | "missing" | "confirm" }[];
};

export const emptyGuideSuggestions: ListingGuideSuggestions = {
  suggestedCategory: null, categoryReason: "", descriptionDraft: "", locationQuestions: [],
  roomOrUnitGuidance: [], pricingBasisExplanation: "", suggestedAmenities: [], photoGuidance: [],
  houseRulesDraft: "", missingFacts: [], nextQuestion: "", nextQuestionOptions: [], completenessChecklist: [],
};
