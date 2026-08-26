import { toStripeTwdMinorUnits } from "./stripe-price.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
    if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
    }
};

Deno.test("converts the website NT$99 price to Stripe TWD minor units", () => {
    assertEquals(toStripeTwdMinorUnits(99), 9900);
});

Deno.test("converts the new monthly membership prices to Stripe TWD minor units", () => {
    assertEquals(toStripeTwdMinorUnits(129), 12900);
    assertEquals(toStripeTwdMinorUnits(299), 29900);
});

Deno.test("supports valid TWD prices with cents", () => {
    assertEquals(toStripeTwdMinorUnits("99.50"), 9950);
});

Deno.test("rejects invalid TWD prices", () => {
    assertEquals(toStripeTwdMinorUnits(null), null);
    assertEquals(toStripeTwdMinorUnits(-1), null);
    assertEquals(toStripeTwdMinorUnits("99.999"), null);
});
