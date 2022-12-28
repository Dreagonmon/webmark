import { assertEquals, assertExists, assertThrows, assertArrayIncludes } from "https://deno.land/std@0.167.0/testing/asserts.ts";
import { BookmarksManager } from "./bookmark.js";

const timer = {
    time: 1,
    adjust (offset) {
        this.time += offset;
    },
    getTime () {
        return this.time;
    },
};
const adjustTime = timer.adjust.bind(timer);
const getTimeSecond = timer.getTime.bind(timer);

Deno.test({
    name: "test BookmarksManager constructor",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(timer.getTime);
        assertExists(bm);
        assertEquals(bm.getLastUpdateTime(), 0);
        assertEquals(bm.listTags().size, 0);
        assertEquals(bm.listBookmarks().size, 0);
    },
});

Deno.test({
    name: "test add bookmark",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(getTimeSecond);
        assertThrows(() => {
            bm.addBookmark("https://cn.bing.com", "special char '`' test");
        });
        bm.addBookmark("https://cn.bing.com", "Bing search");
        assertEquals(bm.hasBookmarkRecord("https://cn.bing.com"), true);
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").url, "https://cn.bing.com");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").title, "Bing search");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").tags.size, 0);
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").updateTime, timer.time);
        assertEquals(bm.listBookmarks().size, 1);
    },
});

Deno.test({
    name: "test update bookmark title",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(getTimeSecond);
        bm.addBookmark("https://cn.bing.com", "Bing search");
        assertThrows(() => {
            bm.updateBookmarkTitle("https://cn.bing.com", "special char '`' test");
        });
        bm.updateBookmarkTitle("https://cn.bing.com", "Search with Bing");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").url, "https://cn.bing.com");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").title, "Search with Bing");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").tags.size, 0);
        assertEquals(bm.listBookmarks().size, 1);
    },
});

Deno.test({
    name: "test del bookmark",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(getTimeSecond);
        bm.addBookmark("https://cn.bing.com", "Bing search");
        bm.deleteBookmark("https://cn.bing.com``");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").url, "https://cn.bing.com");
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com").title, "Bing search");
        assertEquals(bm.listBookmarks().size, 1);
        bm.deleteBookmark("https://cn.bing.com");
        assertEquals(bm.hasBookmarkRecord("https://cn.bing.com"), false);
        assertEquals(bm.getBookmarkRecord("https://cn.bing.com"), undefined);
        assertEquals(bm.listBookmarks().size, 0);
    },
});

Deno.test({
    name: "test add tag to bookmark",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(getTimeSecond);
        bm.addBookmark("https://cn.bing.com", "Bing search");
        assertThrows(() => {
            bm.addTagFor("https://cn.bing.com", "microsoft`s");
        });
        bm.addTagFor("https://cn.bing.com", "search");
        bm.addTagFor("https://cn.bing.com", "microsoft");
        assertEquals(bm.hasTagInfo("search"), true);
        assertEquals(bm.hasTagInfo("microsoft"), true);
        const bmkObj = bm.getBookmarkRecord("https://cn.bing.com");
        assertArrayIncludes(Array.from(bmkObj.tags), [ "search", "microsoft" ]);
        assertEquals(bm.getTagInfo("search").urls.has("https://cn.bing.com"), true);
        assertEquals(bm.getTagInfo("microsoft").urls.has("https://cn.bing.com"), true);
    },
});

Deno.test({
    name: "test delete tag from bookmark",
    fn: () => {
        adjustTime(1);
        const bm = new BookmarksManager(getTimeSecond);
        bm.addBookmark("https://cn.bing.com", "Bing search");
        bm.addBookmark("https://www.google.com", "Google search");
        bm.addTagFor("https://cn.bing.com", "search");
        bm.addTagFor("https://www.google.com", "search");
        bm.addTagFor("https://cn.bing.com", "microsoft");
        bm.deleteTagFor("https://cn.bing.com", "microsoft");
        let bmkObj = bm.getBookmarkRecord("https://cn.bing.com");
        assertEquals(bmkObj.tags.has("microsoft"), false);
        assertEquals(bmkObj.tags.has("search"), true);
        assertEquals(bm.hasTagInfo("search"), true);
        bm.deleteTagFor("https://cn.bing.com", "search");
        bmkObj = bm.getBookmarkRecord("https://cn.bing.com");
        assertEquals(bmkObj.tags.has("search"), false);
        assertEquals(bm.hasTagInfo("search"), true);
        assertEquals(bm.listTags().size, 1);
        bm.deleteTagFor("https://www.google.com", "search");
        assertEquals(bm.hasTagInfo("search"), false);
        assertEquals(bm.listTags().size, 0);
    },
});

Deno.test({
    name: "test add keyword to tag",
    fn: async t => {
        adjustTime(1);
        await t.step({
            name: "test special char",
            fn: () => {
                const bm = new BookmarksManager(getTimeSecond);
                assertThrows(() => {
                    bm.addKeywordFor("special`s tag", "word");
                });
                assertThrows(() => {
                    bm.addKeywordFor("normal tag", "w`rong word");
                });
                assertEquals(bm.listTags().size, 0);
            },
        });
        await t.step({
            name: "add keyword for empty tag",
            fn: () => {
                const bm = new BookmarksManager(getTimeSecond);
                bm.addKeywordFor("tag", "word1");
                bm.addKeywordFor("tag", "word2");
                assertEquals(bm.listTags().size, 1);
                const tagObj = bm.getTagInfo("tag");
                assertEquals(tagObj.urls.size, 0);
                assertEquals(tagObj.keywords.size, 2);
                assertArrayIncludes(Array.from(tagObj.keywords), [ "word1", "word2" ]);
            },
        });
        await t.step({
            name: "add keyword for exist tag",
            fn: () => {
                const bm = new BookmarksManager(getTimeSecond);
                bm.addBookmark("https://cn.bing.com", "Bing Search");
                bm.addTagFor("https://cn.bing.com", "search");
                bm.addKeywordFor("search", "word1");
                bm.addKeywordFor("search", "word2");
                const tagObj = bm.getTagInfo("search");
                assertEquals(tagObj.urls.size, 1);
                assertEquals(tagObj.keywords.size, 2);
                assertArrayIncludes(Array.from(tagObj.keywords), [ "word1", "word2" ]);
            },
        });
    },
});

Deno.test({
    name: "test delete keyword from tag",
    fn: () => {
        const bm = new BookmarksManager(getTimeSecond);
        bm.addKeywordFor("tag", "word1");
        bm.addKeywordFor("tag", "word2");
    },
});
