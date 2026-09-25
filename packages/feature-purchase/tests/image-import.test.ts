import { expect, test } from "bun:test";
import type { LocalDatabase } from "@indyzai/pos-database";
import { createPurchasesApi } from "../src/purchasesApi";

const database = {} as LocalDatabase;
const context = { database, scope: "scope", tenant: "tenant", token: "token" };
const request = async <T>(): Promise<T> => {
    throw new Error("GraphQL is not used by image import.");
};

test("multiple bill images produce an editable draft with existing product matches", async () => {
    const images: string[] = [];
    const api = createPurchasesApi({
        getContext: () => context,
        request,
        analyzeImage: async (_context, image) => {
            images.push(image);
            return {
                items: [
                    {
                        name: " product ",
                        quantity: 2,
                        rate: 25,
                        tax: 5,
                        unit: "box",
                    },
                ],
            };
        },
    });
    const lines = await api.analyzeImages(
        ["image-a", "image-b"],
        [{ id: "42", name: "Product" }],
    );
    expect(images).toEqual(["image-a", "image-b"]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
        productId: "42",
        productName: "Product",
        quantity: 2,
        purchasePrice: 25,
        taxRate: 5,
        unit: "box",
    });
});

test("unreadable quantities are rejected instead of silently becoming quantity one", async () => {
    const api = createPurchasesApi({
        getContext: () => context,
        request,
        analyzeImage: async () => ({
            items: [{ name: "Product", quantity: NaN, rate: 25 }],
        }),
    });
    await expect(api.analyzeImages(["image"], [])).rejects.toThrow(
        "unreadable item",
    );
});

test("image analysis cannot populate a different signed-in workspace", async () => {
    let active = context;
    const api = createPurchasesApi({
        getContext: () => active,
        request,
        analyzeImage: async () => {
            active = { ...context, tenant: "other-tenant" };
            return { items: [{ name: "Product", quantity: 1, rate: 25 }] };
        },
    });
    await expect(api.analyzeImages(["image"], [])).rejects.toThrow(
        "workspace changed",
    );
});
