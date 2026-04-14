import fs from "fs";
import https from "https";

function chatWith(content) {
  const reqbody = fs.readFileSync("./.chatbot.payload.txt", "utf-8");
  const lines = reqbody.split("\n").filter(Boolean);

  const req = https
    .request(
      "https://api.chatbotapp.ai/api/chat",
      {
        headers: Object.fromEntries(
          lines
            .map((_, index) => {
              const odd = index % 2 === 0;
              if (odd) {
                if (lines[index].startsWith(":") || lines[index] === 'content-length') return null;
                return [lines[index], lines[index + 1]];
              } else {
                return null;
              }
            })
            .filter(Boolean),
        ),
        method: "POST",
      },
      (incomMsg) => {
        let chunks = "";

        console.log("answered");

        incomMsg
          .on("data", (chunk) => {
            try {
              console.log("to parse");

              console.log("to parse");
              const jsonStr = chunk.trim().slice(5).trim();
              console.log(jsonStr);

              const data = JSON.parse(jsonStr);

              const delta = data.choices[0].delta;

              if (delta.content) {
                chunks += delta.content;

                console.log("chunk>>>");
                console.log(delta.content);
              }
            } catch (err_) {
              console.log(chunk);
              console.log("parse err", err_);
            }
          })
          .on("end", () => {
            console.log("final>>>");
            console.log(chunks);
          })
          .on("error", (err_) => {
            console.log("res error>>");
            console.log(err_.message);
          });

        incomMsg.setEncoding("utf8");
      },
    )
    .on("error", (err_) => {
      console.log("req error>>");
      console.log(err_.message);
    });

  console.log("sent");

  req.write(
    JSON.stringify({
      messages: [
        {
          role: "user",
          content: content,
        },
      ],
    }),
    "utf8",
  );

  req.end();
}

chatWith(`
There's a strict rules:

1. Please only generate the code, no extra words.
2. No markdown format, just a code block.
3. No Any kind of format, only code.
4. Language: Typescript.

Here is what I want to ask for:

A function that returns the realtime distance between moon and earth.

  `);
