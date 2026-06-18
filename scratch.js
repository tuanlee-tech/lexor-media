import prisma from "./app/db.server.ts";

async function test() {
  try {
    await prisma.appSettings.upsert({
      where: { shop: "test.myshopify.com" },
      update: { apiUrl: "a", apiToken: "b" },
      create: { shop: "test.myshopify.com", apiUrl: "a", apiToken: "b" }
    });
    console.log("Success");
  } catch (e) {
    console.error(e);
  }
}
test();
