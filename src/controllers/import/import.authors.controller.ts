// src/controllers/author.import.controller.ts
import { Request, Response } from "express";
import { handlePostAuthor } from "services/book/author.service";

async function getJSON(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "LMS/1.0" } });
  if (!r.ok) throw new Error(`OpenLibrary error ${r.status}: ${url}`);
  return await r.json();
}

function pickBio(bio: any): string | undefined {
  if (!bio) return undefined;
  if (typeof bio === "string") return bio;
  if (typeof bio?.value === "string") return bio.value;
  return undefined;
}

export const createAuthorFromOpenLibrary = async (
  req: Request,
  res: Response
) => {
  try {
    // 1) Normalize input
    let olids: string[] = [];
    const body = req.body ?? {};

    if (typeof body.olid === "string") {
      olids = [body.olid.trim()];
    } else if (Array.isArray(body.olid)) {
      olids = body.olid.map((s: any) => String(s).trim()).filter(Boolean);
    } else if (Array.isArray(body.olids)) {
      olids = body.olids.map((s: any) => String(s).trim()).filter(Boolean);
    } else {
      throw new Error(
        "Please send 'olid' (string) or 'olids' (string[]) in request body."
      );
    }

    olids = Array.from(new Set(olids.filter(Boolean)));
    if (olids.length === 0) throw new Error("No valid OLIDs provided.");

    // 2) Hàm import 1 tác giả
    const importOne = async (olid: string) => {
      const ol = await getJSON(`https://openlibrary.org/authors/${olid}.json`);
      const name: string | undefined = ol?.name?.trim();
      const bio: string | undefined = pickBio(ol?.bio);
      if (!name)
        throw new Error(`Open Library author has no name (olid=${olid})`);
      const author = await handlePostAuthor(name, bio);
      return {
        source: {
          olid,
          openlibrary_url: `https://openlibrary.org/authors/${olid}`,
        },
        data: author,
      };
    };

    if (olids.length === 1) {
      const item = await importOne(olids[0]);
      return res.status(201).json(item);
    }

    const results = await Promise.allSettled(olids.map(importOne));

    const data = results
      .map((r, i) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean) as Array<{
      source: { olid: string; openlibrary_url: string };
      data: any;
    }>;

    const failed = results
      .map((r, i) =>
        r.status === "rejected"
          ? { olid: olids[i], error: r.reason?.message || String(r.reason) }
          : null
      )
      .filter(Boolean) as Array<{ olid: string; error: string }>;

    return res.status(201).json({ data, failed });
  } catch (err: any) {
    return res
      .status(400)
      .json({ message: err?.message || String(err), data: null });
  }
};
