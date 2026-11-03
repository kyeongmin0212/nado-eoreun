// 검사 전용 SMTP 수신기. 앱이 보낸 메일을 실제로 전달하지 않고 MAIL_SINK_FILE 에 JSON 한 줄씩 적는다.
// 실행: node checks/mail-sink.mjs  (앱은 SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=false 로 띄운다)
import { appendFileSync, mkdirSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

const port = Number(process.env.MAIL_SINK_PORT || 2525)
// Playwright 가 실행마다 test-results 를 비우므로 그 밖(임시 폴더)에 둔다.
const file = process.env.MAIL_SINK_FILE || join(tmpdir(), "nado-mail-sink.jsonl")
mkdirSync(dirname(file), { recursive: true })

createServer((sock) => {
  sock.setEncoding("utf8")
  let buf = ""
  let inData = false
  let lines = []
  let to = []
  const say = (l) => sock.write(`${l}\r\n`)
  say("220 mail-sink ready")
  sock.on("data", (chunk) => {
    buf += chunk
    let i
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (inData) {
        if (line === ".") {
          appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), to, raw: lines.join("\n") })}\n`)
          inData = false
          lines = []
          to = []
          say("250 OK")
        } else lines.push(line.startsWith("..") ? line.slice(1) : line)
        continue
      }
      const cmd = line.slice(0, 4).toUpperCase()
      if (cmd === "EHLO") sock.write("250-mail-sink\r\n250 8BITMIME\r\n")
      else if (cmd === "RCPT") {
        const m = line.match(/<([^>]*)>/)
        if (m) to.push(m[1].toLowerCase())
        say("250 OK")
      } else if (cmd === "DATA") {
        inData = true
        say("354 end with <CRLF>.<CRLF>")
      } else if (cmd === "QUIT") {
        say("221 bye")
        sock.end()
      } else say("250 OK")
    }
  })
  sock.on("error", () => {})
}).listen(port, "127.0.0.1", () => console.log(`mail-sink 127.0.0.1:${port} → ${file}`))
