import { assertEquals, assertExists } from "https://deno.land/std@0.167.0/testing/asserts.ts";
import { BookmarksManager } from "./bookmark.js";

Deno.test({
    name: "test BookmarksManager constructor",
    fn: () => {
        const bm = new BookmarksManager();
        assertExists(bm);
        assertEquals(bm.listTags().size, 0);
        assertEquals(bm.listBookmarks().size, 0);
    },
});