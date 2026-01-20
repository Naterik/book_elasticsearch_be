
import { prisma } from "configs/client";

// ================= CONSTANTS =================
export const ALLOWED_GENERAL_GENRES = [
  // Main Fiction
  "Fiction", "Nonfiction", "Science Fiction", "Fantasy", "Romance", "Mystery", "Horror", "Thriller", 
  "Suspense", "Adventure", "Drama", "Comedy", "Humor", "Action", "Western",
  // Literary
  "Classics", "Classic Literature", "Literature", "Poetry", "Short Stories", "Essays", "Anthologies",
  // Genre Fiction - Specific
  "Historical Fiction", "Crime Fiction", "Mystery Fiction", "Fantasy Fiction", "Romance Fiction", 
  "Horror Fiction", "Suspense Fiction", "Psychological Fiction", "Gothic Fiction",
  "Cyberpunk", "Steampunk", "Dystopian", "Post-Apocalyptic", "Space Opera", 
  "High Fantasy", "Urban Fantasy", "Dark Fantasy", "Magical Realism", "Noir",
  // Age Groups
  "Children's Fiction", "Children's Stories", "Young Adult", "Young Adult Fiction", "Adult", "Middle Grade",
  // Humanities & Social Sciences
  "History", "Biography", "Biography & Autobiography", "Autobiography", "Memoir",
  "Philosophy", "Psychology", "Religion", "Spirituality", "Sociology", "Anthropology", 
  "Archaeology", "Political Science", "International Relations", "Linguistics", "Cultural Studies",
  "Gender Studies", "True Crime",
  // Science & Technology
  "Science", "Physics", "Chemistry", "Biology", "Astronomy", "Botany", "Zoology",
  "Mathematics", "Technology", "Computers", "Engineering", "Software", "Programming", 
  "Artificial Intelligence", "Data Science", "Cybersecurity", "Web Development", "Medicine", "Health",
  // Arts, Design & Media
  "Art", "Music", "Music Theory", "Architecture", "Design", "Graphic Design", 
  "Photography", "Film", "Performing Arts", "Dance", "Fashion",
  // Business & Finance
  "Business", "Economics", "Finance", "Marketing", "Management", "Leadership", 
  "Entrepreneurship", "Investing", "Real Estate", "Law",
  // Lifestyle & Hobbies
  "Travel", "Education", "Cooking", "Baking", "Food & Drink", 
  "Gardening", "Interior Design", "Crafts", "Hobbies", "Home & Garden",
  "Parenting", "Relationships", "Self-Help", "Mindfulness", "Yoga", "Fitness", "Sports", 
  "Nature", "Animals", "Pets",
  // Special Formats
  "Graphic Novels", "Comics", "Comics & Graphic Novels", "Manga", "Picture Books", 
  "Fairy Tales", "Folklore", "Mythology",
  // Themes
  "War Stories", "Love", "Family", "Friendship", "Coming of Age",
  // Styles
  "Contemporary", "Humorous Fiction", "Humorous Stories", "Ghost Stories", 
  "Detective And Mystery Stories", "Adventure Stories"
];

const ALLOWED_GENRES_LOWER = new Set(ALLOWED_GENERAL_GENRES.map(g => g.toLowerCase()));

const RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ================= CACHE =================
export const requestCache = {
  authors: new Map<string, number>(),
  publishers: new Map<string, number>(),
  genres: new Map<string, number>(),
  subjects: new Map<string, number>(),
};

export function clearRequestCache() {
  requestCache.authors.clear();
  requestCache.publishers.clear();
  requestCache.genres.clear();
  requestCache.subjects.clear();
}

// ================= FETCH HELPERS =================
export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getJSON<T = any>(url: string, attempt = 1): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const r = await fetch(url, {
      headers: { "User-Agent": "LMS-Importer/1.0", Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!r.ok) {
        // Retry on rate limit or server error
      if ((r.status === 429 || r.status >= 500) && attempt < RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(backoff);
        return getJSON<T>(url, attempt + 1);
      }
      throw new Error(`OpenLibrary Status ${r.status}`);
    }
    return (await r.json()) as T;
  } catch (err) {
    if (attempt < RETRIES) {
      await sleep(RETRY_BASE_MS);
      return getJSON<T>(url, attempt + 1);
    }
    throw err;
  }
}

// ================= VALIDATION HELPERS =================

/**
 * Sanitizes book title:
 * - Removes HTML tags (<i>...</i>)
 * - Removes brackets/indices like [12], [Vol 1] if not meaningful part of title
 * - Removes trailing " / by Author"
 * - Trims whitespace and weird punctuation
 */
export function cleanBookTitle(rawTitle: string): string {
    if (!rawTitle) return "";
    let t = rawTitle;

    // 1. Remove HTML tags
    t = t.replace(/<[^>]*>/g, "");

    // 2. Remove common noisy suffixes like " / by Author Name"
    t = t.replace(/\s\/\s+by\s+.*$/i, "");

    // 3. Remove brackets like [1], [10] often used for series index
    t = t.replace(/\s\[\d+\]/g, "");

    // 4. Remove start/end non-word chars (except common ones)
    // Keep standard start chars (A-Z, 0-9, ( ), and Vietnamese chars
    // Unicode ranges: \u00C0-\u1EF9
    t = t.replace(/^[^a-zA-Z0-9(\u00C0-\u1EF9]+/, ""); 
    
    // 5. Remove surrounding quotes if matching
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
        t = t.substring(1, t.length - 1);
    }

    // 6. Fix Vietnamese specific issues & Normalization
    // Normalize to NFC (Precomposed) to fix "ổ" vs "ổ"
    t = t.normalize("NFC");
    
    // Fix comma spacing: "abc , def" -> "abc, def"
    t = t.replace(/\s+,/g, ",");
    
    // 7. Compress spaces
    t = t.replace(/\s+/g, " ").trim();

    return t;
}

export function isValidTitle(title: string): boolean {
  if (!title) return false;
  // We clean it first to check valid length
  const t = cleanBookTitle(title);
  
  if (t.length < 2) return false;
  if (/^untitled$/i.test(t)) return false;
  if (/^test$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false; 
  return true;
}

export function isValidIsbn(isbn: string): boolean {
  if (!isbn) return false;
  const t = isbn.trim();
  if (t.startsWith("OL-") || t.endsWith("W")) return false;
  if (!/^\d+$/.test(t)) return false;
  if (t.length !== 13) return false; // Strict 13 checking per requirement
  return true;
}

export function mapToAllowedGenre(rawName: string): string | null {
    const lowerRaw = rawName.toLowerCase().trim();
    
    // 1. Direct match
    const directMatch = ALLOWED_GENERAL_GENRES.find((g) => g.toLowerCase() === lowerRaw);
    if (directMatch) return directMatch;
  
    // 2. Simplification
    const parts = rawName.split(/[\(--,.]/);
    const simpleName = parts[0].trim().toLowerCase();
    
    if (simpleName.length > 0) {
      const simpleMatch = ALLOWED_GENERAL_GENRES.find((g) => g.toLowerCase() === simpleName);
      if (simpleMatch) return simpleMatch;
    }
    return null;
}

// ================= DB HELPERS =================
export function pickText(x: any): string {
    if (typeof x === "string") return x;
    if (typeof x?.value === "string") return x.value;
    return "";
}

export function ensureShortDesc(text: string | null | undefined): string {
    if (!text || !text.trim()) return "N/A";
    const cleanText = text.trim();
    if (cleanText.length <= 255) return cleanText;
    let truncated = cleanText.slice(0, 252);
    const lastSpaceIndex = truncated.lastIndexOf(" ");
    if (lastSpaceIndex > 0) truncated = truncated.slice(0, lastSpaceIndex);
    return truncated + "...";
}

export async function ensureAuthor(name: string, bio: string): Promise<number> {
    if (requestCache.authors.has(name)) {
      return requestCache.authors.get(name)!;
    }
    const record = await prisma.author.upsert({
      where: { name: name },
      update: {},
      create: { name, bio: bio || null },
    });
    requestCache.authors.set(name, record.id);
    return record.id;
}
  
export async function ensurePublisher(name: string): Promise<number> {
    const cleanName = name ? name.trim() : "Unknown Publisher";
    if (requestCache.publishers.has(cleanName)) {
      return requestCache.publishers.get(cleanName)!;
    }
    const record = await prisma.publisher.upsert({
      where: { name: cleanName },
      update: {},
      create: { name: cleanName, description: "Imported from OpenLibrary" },
    });
    requestCache.publishers.set(cleanName, record.id);
    return record.id;
}

/**
 * Ensures genres only if they match the ALLOWED list.
 * STRICT MODE: If strict=true, only allow genres in ALLOWED_GENERAL_GENRES.
 */
export async function ensureGenres(subjects: string[], strict = true): Promise<number[]> {
    if (!subjects || subjects.length === 0) return [];
  
    const validGenreNames = new Set<string>();
    
    for (const sub of subjects) {
        const allowed = mapToAllowedGenre(sub);
        if (allowed) {
            validGenreNames.add(allowed);
        } else if (!strict) {
            // If not strict, allow raw subject name? 
            // The user requested "valid genre" requirement. We assume Strict.
        }
    }
  
    const ids: number[] = [];
    const sortedNames = Array.from(validGenreNames).slice(0, 5); // Limit per book
    
    for (const name of sortedNames) {
      if (requestCache.genres.has(name)) {
        ids.push(requestCache.genres.get(name)!);
        continue;
      }
      try {
        const record = await prisma.genre.upsert({
          where: { name: name },
          update: {},
          create: { name: name, description: `Genre: ${name}` },
        });
        requestCache.genres.set(name, record.id);
        ids.push(record.id);
      } catch (e) { /* ignore */ }
    }
    return ids;
}

export async function ensureSubject(name: string, workIds: string[] = []): Promise<number> {
  if (requestCache.subjects.has(name)) {
    return requestCache.subjects.get(name)!;
  }
  try {
    const record = await prisma.genre.upsert({
      where: { name: name },
      update: {},
      create: {
        name: name,
        description: `Subject: ${name} (from OpenLibrary) - ${workIds.length} works`,
      },
    });
    requestCache.subjects.set(name, record.id);
    return record.id;
  } catch (e) {
    return -1;
  }
}
