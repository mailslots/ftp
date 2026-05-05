import { NextResponse } from "next/server";
import { createNineQAssessment, updateNineQContact } from "@/lib/nineq";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const assessment = await createNineQAssessment({
      clientId: String(body.clientId || ""),
      answers: Array.isArray(body.answers) ? body.answers : [],
    });

    return NextResponse.json({ saved: Boolean(assessment), assessment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Missing assessment id" }, { status: 400 });

    const assessment = await updateNineQContact({
      id,
      name: body.name,
      year: body.year,
      group: body.group,
      phone: body.phone,
      consentContact: body.consentContact,
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
