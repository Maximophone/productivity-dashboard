const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to get the client, actually we need the model manager but the SDK exposes it differently depending on version
        // The node SDK doesn't straightforwardly expose listModels on the top level client in all versions?
        // Let's try to infer or just try standard ones.
        // Actually, let's just try to generate with gemini-pro to see if it works.
        console.log("Trying gemini-1.5-flash-001...");
        const modelFlash001 = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
        await modelFlash001.generateContent("Test");
        console.log("gemini-1.5-flash-001 works!");

        console.log("Trying gemini-pro...");
        const modelPro = genAI.getGenerativeModel({ model: "gemini-pro" });
        await modelPro.generateContent("Test");
        console.log("gemini-pro works!");

    } catch (error) {
        console.error("Error:", error.message);
    }
}

listModels();
