import { describe, expect, it } from "vitest";
import { approvedFaqAnswer, formatLivePropertyMatches, noMatchAnswer } from "@/features/support/chat-rules";

describe("support chatbot factuality safeguards",()=>{
 it("never claims to confirm availability or reservations",()=>{const answer=approvedFaqAnswer("Can you confirm availability and make a reservation?");expect(answer).toContain("cannot confirm room availability");expect(answer).toContain("cannot");});
 it("does not claim guest accommodation payments are processed",()=>{expect(approvedFaqAnswer("Can I pay for accommodation here?")).toContain("does not collect guest accommodation payments");});
 it("does not infer an unprovided price or facilities",()=>{const answer=approvedFaqAnswer("What is the price and what facilities are included?");expect(answer).toContain("will not estimate or invent missing details");});
 it("uses only values in the actual property result and says when price is missing",()=>{const answer=formatLivePropertyMatches([{name:"Test Stay",slug:"test-stay",city_name:"Ilorin",state_name:"Kwara",price_amount:null,price_basis:null,verification_status:"unverified"}]);expect(answer).toContain("Test Stay");expect(answer).toContain("Ilorin, Kwara");expect(answer).toContain("Price not provided");expect(answer).toContain("not verified");expect(answer).not.toContain("₦");});
 it("does not invent results when no live match is available",()=>{expect(formatLivePropertyMatches([])).toBeNull();expect(noMatchAnswer).toContain("do not want to guess or invent");});
 it("directs provider onboarding and human support to actual site routes",()=>{expect(approvedFaqAnswer("How do I register as a provider?")).toContain("provider registration");expect(approvedFaqAnswer("I need a human support agent")).toContain("human support team");});
});
