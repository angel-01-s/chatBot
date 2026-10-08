import express from "express";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

if(!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env");
}

const app = express();
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});  //set up client

app.use(express.json());
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
app.use(express.static(publicDir));

app.post("/api/chat", async (req, res) => {
    const message = req.body?.message;

    if(typeof message !== "string" || !message.trim()) {
        return res.status(400).json({error:"Please enter a message."});
    }

    try {
        const stream = await ai.interactions.create({
            model: "gemini-3.5-flash-lite",
            input: message.trim(),
            stream: true,
        });

        res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");

        let streamedText = "";
        for await (const event of stream) {
            if (
                event.event_type === "step.delta" &&
                event.delta.type === "text"
            ) {
                streamedText += event.delta.text;
                res.write(`${JSON.stringify({ text: event.delta.text })}\n`);
            }

            if (event.event_type === "interaction.completed" && !streamedText) {
                const finalText = event.interaction.steps
                    ?.filter((step) => step.type === "model_output")
                    .flatMap((step) => step.content ?? [])
                    .filter((content) => content.type === "text")
                    .map((content) => content.text)
                    .join("");

                if (finalText) {
                    streamedText = finalText;
                    res.write(`${JSON.stringify({ text: finalText })}\n`);
                }
            }
        }

        if (!streamedText) {
            console.error("Gemini stream completed without any text output.");
            res.write(`${JSON.stringify({ error: "Gemini returned an empty response. Check the server log." })}\n`);
        }

        res.end();
    } catch (error) {
        console.error("Gemini request failed:", error);
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown Gemini API error.";

        if (res.headersSent) {
            res.write(`${JSON.stringify({ error: `Gemini stream failed: ${errorMessage}` })}\n`);
            res.end();
        } else {
            res.status(502).json({ error: `Gemini API request failed: ${errorMessage}` });
        }
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});