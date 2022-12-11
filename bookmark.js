#!/usr/bin/env -S deno run --allow-env
"use strict";
/**
 * Compressed bookmark record.
 * - splited by '`' (the key below ESC)
 * - url|updateTime|title|tag1|tag2|...|tagN
 * @typedef {string} CompressedBookmarkRecord
 */
/**
 * Compressed tag info
 * - splited by '`' (the key below ESC)
 * - tagName|updateTime|keywords1|keywords2|...|keywordsN
 * @typedef {string} CompressedTagInfo
 */
/**
 * Compressed bookmarks info
 * @typedef {Object} CompressedBookmarks
 * @property {number} version data version
 * @property {number} lastUpdateTime last update time (unix seconds)
 * @property {number} lastClearTime last clear time (unix seconds)
 * @property {Array<CompressedTagInfo>} tags
 * @property {Array<CompressedBookmarkRecord>} bookmarks
 */
/**
 * Bookmark record
 * @typedef {Object} BookmarkRecord
 * @property {string} url
 * @property {number} updateTime
 * @property {string} title title === "" means can deleted
 * @property {Set<string>} tags
 */
/**
 * Tag info
 * @typedef {Object} TagInfo
 * @property {string} tagName
 * @property {number} updateTime
 * @property {Set<string>} keywords keywords.size <= 0 means can deleted
 * @property {Set<string>} urls
 */
/**
 * Bookmarks info
 * @typedef {Object} Bookmarks
 * @property {number} version data version
 * @property {number} lastUpdateTime last update time (unix seconds)
 * @property {number} lastClearTime last clear time (unix seconds)
 * @property {Map<string, TagInfo>} tags tagName -> tagInfo
 * @property {Map<string, BookmarkRecord>} bookmarks url -> bookmark
 */

const CURRENT_DATA_VERSION = 1;

const getUnixTimeSeconds = () => {
  return Math.floor(Date.now() / 1000);
};

/** @type {(set: Set, sep: string) => string} */
const joinSet = (set, sep) => {
  const lst = [];
  set.forEach((val) => { lst.push(val); });
  return lst.join(sep);
};

/** @type {() => TagInfo} */
const newTagInfo = () => {
  return {
    tagName: "",
    updateTime: 0,
    keywords: new Set(),
    urls: new Set(),
  };
};

/** @type {() => BookmarkRecord} */
const newBookmarkRecord = () => {
  return {
    url: "",
    updateTime: 0,
    title: "",
    tags: new Set()
  };
};

/** @type {(tagObj: TagInfo) => TagInfo} */
const copyTagInfo = (tagObj) => {
  const newTagObj = {
    ...tagObj
  };
  newTagObj.keywords = new Set(tagObj.keywords);
  newTagObj.urls = new Set(tagObj.urls);
  return newTagObj;
};

/** @type {(tagObj: BookmarkRecord) => BookmarkRecord} */
const copyBookmarkRecord = (bmkObj) => {
  const newBmkObj = {
    ...bmkObj
  };
  newBmkObj.tags = new Set(bmkObj.tags);
  return newBmkObj;
};

/** @type {(text: string) => string} */
export const replaceSpecialChar = (text) => {
  return text.replaceAll("`", "'");
};

/** @type {(text: string) => void} */
const checkSpecialChar = (text) => {
  if (text.indexOf("`") >= 0) {
    throw new Error(`Bad Char '\`': ${text}`);
  }
};

export class BookmarksManager {
  /** @type {Bookmarks} */
  #bmk;
  /** @type {() => number} A function return unix seconds */
  #getTime;

  constructor (timefn = getUnixTimeSeconds) {
    this.#getTime = timefn;
    this.#bmk = {
      version: CURRENT_DATA_VERSION,
      lastUpdateTime: 0,
      lastClearTime: 0,
      tags: new Map(),
      bookmarks: new Map(),
    };
  }

  /**
   * add a bookmark
   * @param {string} url 
   * @param {string} title 
   */
  addBookmark (url, title) {
    checkSpecialChar(url);
    checkSpecialChar(title);
    if (!this.hasBookmarkRecord(url)) {
      const bmkObj = newBookmarkRecord();
      bmkObj.url = url;
      bmkObj.title = title;
      bmkObj.updateTime = this.#getTime();
      this.#bmk.lastUpdateTime = bmkObj.updateTime;
      this.#bmk.bookmarks.set(url, bmkObj);
    } else {
      this.updateBookmarkTitle(url, title);
    }
  }

  /**
   * delete a bookmark
   * @param {string} url 
   * @param {string} title 
   */
  deleteBookmark (url) {
    if (this.hasBookmarkRecord(url)) {
      const bmkObj = this.#bmk.bookmarks.get(url);
      const tagToDelete = new Set(bmkObj.tags);
      for (const tag of tagToDelete) {
        // delete all tag
        this.deleteTagFor(url, tag);
      }
      bmkObj.title = "";
      bmkObj.updateTime = this.#getTime();
      this.#bmk.lastUpdateTime = bmkObj.updateTime;
    }
  }

  /**
   * update title for a bookmark
   * @param {string} url 
   * @param {string} title 
   */
  updateBookmarkTitle (url, title) {
    checkSpecialChar(title);
    if (this.hasBookmarkRecord(url)) {
      const bmkObj = this.#bmk.bookmarks.get(url);
      if (bmkObj.title !== title) {
        bmkObj.title = title;
        bmkObj.updateTime = this.#getTime();
        this.#bmk.lastUpdateTime = bmkObj.updateTime;
      }
    }
  }

  /**
   * add a tag to a bookmark
   * @param {string} url 
   * @param {string} tag 
   */
  addTagFor (url, tag) {
    checkSpecialChar(tag);
    if (this.hasBookmarkRecord(url)) {
      const bmkObj = this.#bmk.bookmarks.get(url);
      if (!bmkObj.tags.has(tag)) {
        bmkObj.tags.add(tag);
        bmkObj.updateTime = this.#getTime();
        this.#bmk.lastUpdateTime = bmkObj.updateTime;
        if (this.#bmk.tags.has(tag)) { // can't use hasTagInfo. e.g. deleted modified keyword tag
          const tagObj = this.#bmk.tags.get(tag);
          tagObj.urls.add(url);
        } else {
          // create empty tag
          const tagObj = newTagInfo();
          tagObj.tagName = tag;
          tagObj.urls.add(url);
          this.#bmk.tags.set(tag, tagObj);
        }
      }
    }
  }

  /**
   * delete a tag from a bookmark
   * @param {string} url 
   * @param {string} tag 
   */
  deleteTagFor (url, tag) {
    if (this.hasBookmarkRecord(url)) {
      const bmkObj = this.#bmk.bookmarks.get(url);
      if (bmkObj.tags.has(tag)) {
        bmkObj.tags.delete(tag);
        bmkObj.updateTime = this.#getTime();
        this.#bmk.lastUpdateTime = bmkObj.updateTime;
        if (this.#bmk.tags.has(tag)) {
          const tagObj = this.#bmk.tags.get(tag);
          tagObj.urls.delete(url);
          if (tagObj.urls.size <= 0 && tagObj.keywords.size <= 0 && tagObj.updateTime <= 0) {
            // delete empty auto generated tag
            this.#bmk.tags.delete(tag);
          }
        }
      }
    }
  }

  /**
   * add a keyword to a tag
   * @param {string} tag 
   * @param {string} kw 
   */
  addKeywordFor (tag, kw) {
    checkSpecialChar(tag);
    checkSpecialChar(kw);
    kw = kw.toLocaleLowerCase();
    if (this.hasTagInfo(tag)) {
      const tagObj = this.#bmk.tags.get(tag);
      if (!tagObj.keywords.has(kw) || tag === kw) {
        tagObj.keywords.add(kw);
        tagObj.updateTime = this.#getTime();
        this.#bmk.lastUpdateTime = tagObj.updateTime;
      }
    } else {
      if (tag === kw) {
        return;
      }
      const tagObj = newTagInfo(tag);
      tagObj.tagName = tag;
      tagObj.keywords.add(kw);
      tagObj.updateTime = this.#getTime();
      this.#bmk.lastUpdateTime = tagObj.updateTime;
      this.#bmk.tags.set(tag, tagObj);
    }
  }

  /**
   * delete a keyword from a tag
   * @param {string} tag 
   * @param {string} kw 
   */
  deleteKeywordFor (tag, kw) {
    kw = kw.toLocaleLowerCase();
    if (this.hasTagInfo(tag)) {
      const tagObj = this.#bmk.tags.get(tag);
      if (tagObj.keywords.has(kw)) {
        tagObj.keywords.delete(kw);
        tagObj.updateTime = this.#getTime();
        this.#bmk.lastUpdateTime = tagObj.updateTime;
      }
    }
  }

  /**
   * get tag info
   * @param {string} tag 
   * @returns {TagInfo | undefined}
   */
  getTagInfo (tag) {
    if (this.hasTagInfo(tag)) {
      const tagObj = this.#bmk.tags.get(tag);
      return copyTagInfo(tagObj);
    }
    return undefined;
  }

  /**
   * get bookmark record
   * @param {string} url 
   * @returns {BookmarkRecord | undefined}
   */
  getBookmarkRecord (url) {
    if (this.hasBookmarkRecord(url)) {
      const bmkObj = this.#bmk.bookmarks.get(url);
      return copyBookmarkRecord(bmkObj);
    }
    return undefined;
  }

  /** @type {() => number} */
  getLastUpdateTime () {
    return this.#bmk.lastUpdateTime;
  }

  /**
   * has tag info, only actived tags or modified tags are visiable
   * @param {string} tag 
   * @returns {boolean}
   */
  hasTagInfo (tag) {
    if (this.#bmk.tags.has(tag)) {
      const tagObj = this.#bmk.tags.get(tag);
      return tagObj.urls.size > 0 || tagObj.keywords.size > 0;
    }
    return false;
  }

  /**
   * has bookmark record
   * @param {string} url 
   * @returns {boolean}
   */
  hasBookmarkRecord (url) {
    if (this.#bmk.bookmarks.has(url)) {
      return this.#bmk.bookmarks.get(url).title !== "";
    }
    return false;
  }

  /** @type {() => Set<string>} */
  listTags () {
    const lst = new Set();
    for (const tag of this.#bmk.tags.keys()) {
      if (this.hasTagInfo(tag)) {
        lst.add(tag);
      }
    }
    return lst;
  }

  /**
   * list bookmarks, with optional filters
   * @param {Set<string>} [tagFilters]
   * @returns {Set<string>}
   */
  listBookmarks (tagFilters = new Set()) {
    const lst = new Set();
    for (const [ url, bmkObj ] of this.#bmk.bookmarks) {
      if (!this.hasBookmarkRecord(url)) {
        continue;
      }
      let match = true;
      for (const tag of tagFilters) {
        if (!bmkObj.tags.has(tag)) {
          match = false;
          break;
        }
      }
      if (match) {
        lst.add(url);
      }
    }
    return lst;
  }

  /**
   * clear database
   * @param {number} [beforeSecond] clear N seconds before current time
   * @param {number} [beforeTime] clear before time N
   */
  clearDeletedItems (beforeSecond = 0, beforeTime = -1) {
    if (beforeTime < 0) {
      beforeTime = this.#getTime() - beforeSecond;
    }
    /** @type {Set<string>} */
    const needDelete = new Set();
    let maxUpdateTime = 0;
    // find tags need to be deleted
    for (const [ tag, tagObj ] of this.#bmk.tags) {
      if (this.hasTagInfo(tag)) {
        continue;
      }
      if (tagObj.updateTime <= beforeTime) {
        needDelete.add(tag);
        maxUpdateTime = Math.max(maxUpdateTime, tagObj.updateTime);
      }
    }
    // delete tags
    for (const tag of needDelete) {
      this.#bmk.tags.delete(tag);
    }
    needDelete.clear();
    // find bookmarks need to be deleted
    for (const [ url, bmkObj ] of this.#bmk.bookmarks) {
      if (this.hasBookmarkRecord(url)) {
        continue;
      }
      if (bmkObj.updateTime <= beforeTime) {
        needDelete.add(url);
        maxUpdateTime = Math.max(maxUpdateTime, bmkObj.updateTime);
      }
    }
    // delete bookmarks
    for (const url of needDelete) {
      this.#bmk.bookmarks.delete(url);
    }
    // record
    this.#bmk.lastClearTime = maxUpdateTime;
    this.#bmk.lastUpdateTime = this.#getTime();
  }

  /** 
   * merge another bookmarks manager
   * - clear deleted items
   * - reserve newest items
   * @param {BookmarksManager} other 
   * @return {boolean} if need upload to sync (self had changed, other doesn't have these changes)
   */
  merge (other) {
    const sbmk = this.#bmk;
    const obmk = other.#bmk;
    if (sbmk.lastUpdateTime === obmk.lastUpdateTime) {
      return;
    }
    let flagChanged = false;
    // clear deleted items
    if (sbmk.lastClearTime < obmk.lastClearTime) {
      this.clearDeletedItems(0, obmk.lastClearTime);
    } else if (sbmk.lastClearTime > obmk.lastClearTime) {
      other.clearDeletedItems(0, sbmk.lastClearTime);
      flagChanged = true;
    }
    // merge tags
    for (const [ otag, otagObj ] of obmk.tags) {
      if (sbmk.tags.has(otag)) {
        const tagObj = sbmk.tags.get(otag);
        if (otagObj.updateTime > tagObj.updateTime) {
          sbmk.tags.set(otag, copyTagInfo(otagObj));
        }
      } else {
        sbmk.tags.set(otag, copyTagInfo(otagObj));
      }
    }
    for (const [ tag, tagObj ] of sbmk.tags) {
      if (obmk.tags.has(tag)) {
        const otagObj = obmk.tags.get(tag);
        if (tagObj.updateTime > otagObj.updateTime) {
          obmk.tags.set(tag, copyTagInfo(tagObj));
          flagChanged = true;
        }
      } else {
        sbmk.tags.set(tag, copyTagInfo(tagObj));
        flagChanged = true;
      }
    }
    // merge bookmarks
    for (const [ ourl, obmkObj ] of obmk.bookmarks) {
      if (sbmk.bookmarks.has(ourl)) {
        const bmkObj = sbmk.bookmarks.get(ourl);
        if (obmkObj.updateTime > bmkObj.updateTime) {
          sbmk.bookmarks.set(ourl, copyBookmarkRecord(obmkObj));
        }
      } else {
        sbmk.bookmarks.set(ourl, copyBookmarkRecord(obmkObj));
      }
    }
    for (const [ url, bmkObj ] of sbmk.bookmarks) {
      if (obmk.bookmarks.has(url)) {
        const obmkObj = obmk.bookmarks.get(url);
        if (bmkObj.updateTime > obmkObj.updateTime) {
          obmk.bookmarks.set(url, copyBookmarkRecord(bmkObj));
          flagChanged = true;
        }
      } else {
        obmk.bookmarks.set(url, copyBookmarkRecord(bmkObj));
        flagChanged = true;
      }
    }
    // re-generate tags' url set
    for (const self of [ sbmk, obmk ]) {
      for (const [ _, tagObj ] of self.tags) {
        tagObj.urls.clear();
      }
      for (const [ url, bmkObj ] of self.bookmarks) {
        for (const tag of bmkObj.tags) {
          if (self.tags.has(tag)) {
            self.tags.get(tag).urls.add(url);
          } else {
            const tagObj = newTagInfo();
            tagObj.tagName = tag;
            tagObj.urls.add(url);
            self.tags.set(tag, tagObj);
          }
        }
      }
    }
    // record
    sbmk.lastClearTime = Math.max(sbmk.lastClearTime, obmk.lastClearTime);
    obmk.lastClearTime = Math.max(sbmk.lastClearTime, obmk.lastClearTime);
    sbmk.lastUpdateTime = Math.max(sbmk.lastUpdateTime, obmk.lastUpdateTime);
    obmk.lastUpdateTime = Math.max(sbmk.lastUpdateTime, obmk.lastUpdateTime);
    return flagChanged;
  }

  /** @type {() => string} */
  toJSON () {
    /** @type {CompressedBookmarks} */
    const jsonObj = {
      version: this.#bmk.version,
      lastUpdateTime: this.#bmk.lastUpdateTime,
      lastClearTime: this.#bmk.lastClearTime,
      tags: [],
      bookmarks: [],
    };
    for (const [ _, tag ] of this.#bmk.tags) {
      // skip auto generated tags
      if (tag.keywords.size <= 0 && tag.updateTime <= 0) {
        continue;
      }
      if (tag.keywords.size <= 0) {
        /** @type {CompressedTagInfo} */
        const compressedTag = `${tag.tagName}\`${tag.updateTime}`;
        jsonObj.tags.push(compressedTag);
      } else {
        /** @type {CompressedTagInfo} */
        const compressedTag = `${tag.tagName}\`${tag.updateTime}\`${joinSet(tag.keywords, "\`")}`;
        jsonObj.tags.push(compressedTag);
      }
    }
    for (const [ _, mark ] of this.#bmk.bookmarks) {
      if (mark.tags.size <= 0) {
        /** @type {CompressedTagInfo} */
        const compressedBookmark = `${mark.url}\`${mark.updateTime}\`${mark.title}`;
        jsonObj.bookmarks.push(compressedBookmark);
      } else {
        /** @type {CompressedTagInfo} */
        const compressedBookmark = `${mark.url}\`${mark.updateTime}\`${mark.title}\`${joinSet(mark.tags, "\`")}`;
        jsonObj.bookmarks.push(compressedBookmark);
      }
    }
    return JSON.stringify(jsonObj);
  }

  /** @type {(jsonObj: CompressedBookmarks) => Bookmarks} */
  static loadDataV1 (jsonObj) {
    /** @type {Bookmarks} */
    const bmk = {
      version: jsonObj.version,
      lastUpdateTime: jsonObj.lastUpdateTime,
      lastClearTime: jsonObj.lastClearTime,
      tags: new Map(),
      bookmarks: new Map(),
    };
    // parse tags
    for (const tag of jsonObj.tags) {
      const tagInfo = tag.split("`");
      const tagName = tagInfo[ 0 ];
      const tagObj = newTagInfo();
      tagObj.tagName = tagName;
      tagObj.updateTime = Number.parseInt(tagInfo[ 1 ]);
      tagObj.keywords = new Set(tagInfo.slice(2));
      bmk.tags.set(tagName, tagObj);
    }
    // parse bookmarks
    for (const mark of jsonObj.bookmarks) {
      const markInfo = mark.split("`");
      const url = markInfo[ 0 ];
      const tags = new Set(markInfo.slice(3));
      const bmkObj = newBookmarkRecord();
      bmkObj.url = url;
      bmkObj.updateTime = Number.parseInt(markInfo[ 1 ]);
      bmkObj.title = markInfo[ 2 ];
      bmkObj.tags = tags;
      bmk.bookmarks.set(url, bmkObj);
      for (const tag of tags) {
        if (bmk.tags.has(tag)) {
          bmk.tags.get(tag).urls.add(url);
        } else {
          const tagObj = newTagInfo();
          tagObj.tagName = tag;
          tagObj.urls.add(url);
          bmk.tags.set(tag, tagObj);
        }
      }
    }
    return bmk;
  }

  /** @type {(jsonText: string) => void} */
  fromJSON (jsonText) {
    /** @type {CompressedBookmarks} */
    const jsonObj = JSON.parse(jsonText);
    if (jsonObj.version == 1) {
      this.#bmk = BookmarksManager.loadDataV1(jsonObj);
    }
  }

  _print () {
    console.log("");
    console.log("==============================> BookmarksManager <==============================");
    console.log("version", this.#bmk.version);
    console.log("lastUpdate", this.#bmk.lastUpdateTime);
    console.log("lastClear", this.#bmk.lastClearTime);
    for (const [ _, tag ] of this.#bmk.tags) {
      const deleted = !this.hasTagInfo(tag.tagName);
      console.log("tag:", tag.updateTime, tag.tagName, deleted ? "(deleted)" : "");
      console.log("    ", tag.keywords);
      for (const url of tag.urls) {
        console.log("     -", url);
      }
    }
    for (const [ _, mark ] of this.#bmk.bookmarks) {
      const deleted = !this.hasBookmarkRecord(mark.url);
      console.log("mark", mark.updateTime, mark.url, deleted ? "(deleted)" : "");
      console.log("    ", mark.title);
      console.log("    ", mark.tags);
    }
    console.log("^>------------------------------<==============>------------------------------<^");
  }
}

// Learn more at https://deno.land/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const timer = {
    time: 1,
    adjust (offset) {
      this.time += offset;
    },
    getTime () {
      return this.time;
    }
  };
  const adjustTime = timer.adjust.bind(timer);
  const bm1 = new BookmarksManager(timer.getTime.bind(timer));
  const bm2 = new BookmarksManager(timer.getTime.bind(timer));
  const cloud = {
    store: ""
  };
  const _save = (bm) => {
    const data = bm.toJSON();
    cloud.store = data;
  };
  const _load = (bm) => {
    const data = cloud.store;
    bm.fromJSON(data);
  };

  bm1.addBookmark("http://dragon.tech", "This is the draggno's place");
  bm1.addTagFor("http://dragon.tech", "dragon");
  _save(bm1);
  _load(bm2);

  adjustTime(5);
  bm2.addBookmark("http://ice-rime.tech", "Ice Rime");
  bm2.addTagFor("http://ice-rime.tech", "tech");

  adjustTime(5);
  bm1.addBookmark("http://dreagonmon.top", "Ice Rime");
  bm1.addTagFor("http://dreagonmon.top", "wyvern");
  bm1.addTagFor("http://dreagonmon.top", "dragon");

  adjustTime(5);
  bm2.addKeywordFor("dragon", "kobold");
  bm2.addKeywordFor("dragon", "wyvern");

  bm1.merge(bm2);

  // adjustTime(5)
  // bm1.deleteBookmark("http://dragon.tech")
  // bm1.deleteBookmark("http://ice-rime.tech")
  // bm1.deleteKeywordFor("dragon", "kobold")
  // bm1.deleteKeywordFor("dragon", "wyvern")

  // changed = bm1.merge(bm2)
  // console.log(changed)

  // adjustTime(5)
  // bm1.clearDeletedItems(0)

  // adjustTime(5)
  // bm2._print()
  // changed = bm2.merge(bm1)
  // console.log(changed)
  // bm2._print()
  // bm2._print()
  console.log(bm1.listBookmarks(new Set([])));

  // print
  const data = bm1.toJSON();
  console.log(data);
  console.log("Data Size:", data.length);
  bm1._print();
  bm1.fromJSON(data);
  bm1._print();
}
