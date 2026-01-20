export const BOOK_INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
  "index.max_ngram_diff": 50,
  analysis: {
    analyzer: {
      autocomplete_index: {
        type: "custom",
        tokenizer: "edge_ngram_tokenizer",
        filter: ["lowercase", "asciifolding", "stop"],
      },
      autocomplete_search: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
      prefix_analyzer: {
        type: "custom",
        tokenizer: "keyword", 
        filter: ["lowercase", "asciifolding"],
      },
       vietnamese_standard: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"]
      }
    },
    tokenizer: {
      edge_ngram_tokenizer: {
        type: "edge_ngram",
        min_gram: 2,
        max_gram: 20, 
        token_chars: ["letter", "digit", "punctuation", "symbol"], 
      },
    },
  },
};

export const BOOK_INDEX_MAPPING = {
  properties: {
    id: { type: "long" },
    title: {
      type: "text",
      analyzer: "autocomplete_index",
      search_analyzer: "autocomplete_search",
      fields: {
        keyword: { type: "keyword", ignore_above: 256 },
        prefix: {
            type: "text",
            analyzer: "prefix_analyzer",
            search_analyzer: "prefix_analyzer"
        },
        clean: {
            type: "text",
            analyzer: "vietnamese_standard"
        }
      },
    },
    isbn: {
      type: "text",
      analyzer: "autocomplete_index",
      search_analyzer: "autocomplete_search",
      fields: {
        keyword: { type: "keyword", ignore_above: 256 },
      },
    },
    "authors.name": {
      type: "text",
      analyzer: "autocomplete_index",
      search_analyzer: "autocomplete_search",
    },
    authors: {
        properties: {
            name: {
                type: "text",
                analyzer: "autocomplete_index",
                search_analyzer: "autocomplete_search",
                fields: {
                    keyword: { type: "keyword", ignore_above: 256 }
                }
            }
        }
    },
    publishers: {
        properties: {
            name: {
                type: "text",
                analyzer: "autocomplete_index",
                search_analyzer: "autocomplete_search",
                fields: {
                    keyword: { type: "keyword", ignore_above: 256 }
                }
            }
        }
    },
    genres: {
       properties: {
           genres: {
               properties: {
                   name: {
                       type: "text",
                       analyzer: "autocomplete_index",
                       search_analyzer: "autocomplete_search",
                       fields: {
                           keyword: { type: "keyword", ignore_above: 256 }
                       }
                   }
               }
           }
       }
    },
    shortDesc: {
      type: "text",
      analyzer: "vietnamese_standard", 
    },
    detailDesc: {
      type: "text",
      analyzer: "vietnamese_standard",
    },
    price: { type: "long" },
    quantity: { type: "long" },
    language: { type: "keyword" },
    image: { type: "keyword", index: false }, 
    suggest: {
      type: "completion",
      preserve_separators: true,
    },
  },
};

export const BOOK_COPY_INDEX_MAPPING = {
  properties: {
    id: { type: "long" },
    bookId: { type: "long" },
    
    // Barcode: Needs specialized handling for exact + fuzzy + prefix
    copyNumber: {
      type: "text",
      analyzer: "autocomplete_index", // Use N-gram for partial barcode search (e.g. "123" finds "ABC12345")
      search_analyzer: "autocomplete_search",
      fields: {
        keyword: { type: "keyword", ignore_above: 256 }, // For exact filtering
        prefix: { type: "text", analyzer: "prefix_analyzer", search_analyzer: "prefix_analyzer" }
      }
    },
    
    // Status: Pure keyword for filtering
    status: { type: "keyword" },
    
    // ISBN & Branch
    isbn: { type: "keyword" },
    branch: { type: "keyword" },
    acquiredAt: { type: "date" },
    year_published: { type: "long" },
    
    // Embed minimal Book attributes for Smart Search
    books: {
        properties: {
            id: { type: "long" },
            title: {
                 type: "text",
                 analyzer: "autocomplete_index", // Inherit Smart Search
                 search_analyzer: "autocomplete_search",
                 fields: {
                    keyword: { type: "keyword", ignore_above: 256 },
                    clean: { type: "text", analyzer: "vietnamese_standard" },
                    prefix: {
                        type: "text",
                        analyzer: "prefix_analyzer",
                        search_analyzer: "prefix_analyzer"
                    }
                 }
            },
            // Author is often needed to distinguish books
            // Map as simple text for display/search
             authors: {
               properties: {
                 name: {
                    type: "text",
                    analyzer: "autocomplete_index",
                    search_analyzer: "autocomplete_search"
                 }
               }
             }
        }
    }
  }
};
