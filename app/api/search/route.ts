import { searchDocuments } from "@/lib/vector-search"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { query, topK = 5 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: "Missing 'query' parameter" },
        { status: 400 }
      )
    }

    const results = await searchDocuments(query, topK)

    return NextResponse.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        similarity: Math.round(r.similarity * 100) / 100,
      })),
      totalResults: results.length,
    })
  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}