import { client } from "configs/elastic";
import { Request, Response } from "express";
import { request } from "node:http";
const index = process.env.INDEX_N_GRAM;
const countLanguage = async (request: Request, res: Response) => {
  const data: any = await client.search({
    index,
    size: 0,
    aggs: {
      count_languages: {
        terms: {
          field: "language",
          size: 100,
        },
      },
    },
    filter_path: ["aggregations.count_languages.buckets"],
  });
  res.status(200).json({
    data: data.aggregations.count_languages.buckets,
  });
};

const countGenres = async (request: Request, res: Response) => {
  try {
    const data: any = await client.search({
      index,
      size: 0,
      aggs: {
        count_genres: {
          terms: {
            field: "genres.genres.name.keyword",
          },
        },
      },
    });
    res.status(200).json({
      data: data.aggregations.count_genres.buckets,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
};

const suggestElastic = async (req: Request, res: Response) => {
  try {
    const { q, size = 5 } = req.query;
    const prefix = String(q || "").trim();
    const limit = Math.min(Number(size) || 5, 10);
    if (!prefix)
      return res.status(200).json({ data: { titles: [], authors: [] } });

    const results: any = await client.search({
      index,
      size: 0,
      suggest: {
        title_suggest: {
          prefix,
          completion: {
            field: "title_suggest",
            size: limit,
            skip_duplicates: true,
            fuzzy: { fuzziness: "AUTO" },
          },
        },
        author_suggest: {
          prefix,
          completion: {
            field: "author_suggest",
            size: limit,
            skip_duplicates: true,
            fuzzy: { fuzziness: "AUTO" },
          },
        },
      },
    });

    const titles = (results.suggest?.title_suggest?.[0]?.options || []).map(
      (o: any) => ({ text: o.text })
    );
    const authors = (results.suggest?.author_suggest?.[0]?.options || []).map(
      (o: any) => ({ text: o.text })
    );
    //  if (!titles.length && !authors.length) {
    //   const resp: any = await client.search({
    //     index,
    //     size: limit * 2,
    //     _source: ["title", "authors.name"],
    //     query: {
    //       bool: {
    //         should: [
    //           { match_phrase_prefix: { title: { query: prefix } } },
    //           { match_phrase_prefix: { "authors.name": { query: prefix } } }
    //         ]
    //       }
    //     }
    //   });

    //   const seenT = new Set<string>();
    //   const seenA = new Set<string>();
    //   for (const h of resp.hits.hits) {
    //     const s = h._source;
    //     if (s?.title && !seenT.has(s.title) && titles.length < limit) {
    //       seenT.add(s.title);
    //       titles.push({ text: s.title });
    //     }
    //     const a = s?.authors?.name;
    //     if (a && !seenA.has(a) && authors.length < limit) {
    //       seenA.add(a);
    //       authors.push({ text: a });
    //     }
    //     if (titles.length >= limit && authors.length >= limit) break;
    //   }
    // }
    return res.status(200).json({ data: { titles, authors } });
  } catch (e: any) {
    return res.status(400).json({ message: e.message, data: null });
  }
};

export { countLanguage, suggestElastic, countGenres };
