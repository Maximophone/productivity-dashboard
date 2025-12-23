const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkModel(modelName) {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`Model ${modelName} is AVAILABLE. Response: ${result.response.text()}`);
        return true;
    } catch (e) {
        console.log(`Model ${modelName} failed: ${e.message.split(' ')[0]} ${e.message.split(' ')[1]}`); // Log brief error
        return false;
    }
}

async function main() {
    const modelsToTry = [
        "gemini-3.0-flash-exp",
        "gemini-3.0-flash",
        "gemini-3-flash-preview",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash"
    ];

    for (const m of modelsToTry) {
        await checkModel(m);
    }
}

main();
