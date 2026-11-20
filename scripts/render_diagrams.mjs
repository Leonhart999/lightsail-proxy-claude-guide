// Render tutorial diagrams to high-DPI PNGs using headless Chrome.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "assets", "images");
const TMP_DIR = path.join(ROOT, "scripts", ".tmp");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  throw new Error("Neither Chrome nor Edge was found.");
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #f4f6fb;
    font-family: "Microsoft YaHei UI", "PingFang SC", "Segoe UI", system-ui, -apple-system, sans-serif;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }
  .canvas {
    width: 1200px;
    padding: 32px 36px 30px;
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 22px;
    padding-bottom: 14px;
    border-bottom: 2px solid #e2e8f0;
  }
  .badge-part {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #1d4ed8;
    background: #dbeafe;
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 8px;
  }
  .badge-part.purple { color: #6d28d9; background: #ede9fe; }
  h1 {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.01em;
  }
  .subtitle {
    font-size: 14px;
    color: #475569;
    margin-top: 4px;
  }
  .header-right {
    font-size: 12px;
    color: #64748b;
    font-family: "Cascadia Code", "Consolas", monospace;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 6px 12px;
    border-radius: 8px;
  }
  .card {
    background: #ffffff;
    border: 1px solid #dbe2ec;
    border-radius: 14px;
    padding: 18px 20px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  }
  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .dot.blue { background: #2563eb; }
  .dot.green { background: #16a34a; }
  .dot.orange { background: #ea580c; }
  .dot.purple { background: #7c3aed; }
  .dot.red { background: #dc2626; }
  .dot.teal { background: #0d9488; }
  .mono {
    font-family: "Cascadia Code", "Consolas", "Courier New", monospace;
    font-size: 12.5px;
  }
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
  }
  .pill.blue { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .pill.green { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .pill.amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  .pill.red { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .pill.purple { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
  .pill.slate { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
  .alert {
    margin-top: 14px;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13px;
    line-height: 1.55;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .alert.warn { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
  .alert.info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
  .alert.ok   { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
  .alert-tag {
    font-weight: 800;
    white-space: nowrap;
    padding: 1px 7px;
    border-radius: 5px;
    font-size: 12px;
    margin-top: 1px;
  }
  .alert.warn .alert-tag { background: #dc2626; color: #fff; }
  .alert.info .alert-tag { background: #2563eb; color: #fff; }
  .alert.ok   .alert-tag { background: #16a34a; color: #fff; }
  table.clean {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  table.clean th {
    text-align: left;
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
    padding: 9px 12px;
    border-bottom: 1.5px solid #e2e8f0;
  }
  table.clean td {
    padding: 9px 12px;
    border-bottom: 1px solid #eef2f7;
    vertical-align: middle;
  }
  table.clean tr:last-child td { border-bottom: none; }
  .footer-note {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #64748b;
  }
`;

function wrapHtml(bodyHtml) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>${BASE_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

const DIAGRAMS = [
  // 1. Architecture Overview
  {
    name: "01-architecture-overview.png",
    height: 760,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part">Part 1 · 架构全景</span>
          <h1>单台 AWS Lightsail 全套服务分流架构</h1>
          <div class="subtitle">所有后端服务仅监听 127.0.0.1，对外统一经由 443 端口按 SNI 域名分流，共用一张 *.example.com 通配符证书</div>
        </div>
        <div class="header-right">TCP 443 · UDP 443 · UDP 20000-50000</div>
      </div>

      <div style="display:grid; grid-template-columns: 245px 250px 1fr; gap: 18px; align-items: stretch;">
        <!-- Column 1: Client -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; background:#f8fafc;">
          <div>
            <div class="card-title"><span class="dot blue"></span>用户本机客户端</div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="background:#fff; border:1px solid #bfdbfe; border-radius:10px; padding:12px;">
                <div style="font-weight:700; font-size:14px; color:#1e40af;">v2rayN 代理客户端</div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">拉取订阅 &amp; 建立加密隧道</div>
                <div class="mono" style="margin-top:6px; color:#2563eb;">sg-v4 / sg-v6 / sg-x</div>
              </div>
              <div style="background:#fff; border:1px solid #ddd6fe; border-radius:10px; padding:12px;">
                <div style="font-weight:700; font-size:14px; color:#5b21b6;">Claude Code / CC Switch</div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">调用自建 AI API 网关</div>
                <div class="mono" style="margin-top:6px; color:#7c3aed;">https://api.example.com</div>
              </div>
              <div style="background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:12px;">
                <div style="font-weight:700; font-size:14px; color:#334155;">浏览器 / 外部探测者</div>
                <div style="font-size:12px; color:#475569; margin-top:4px;">访问面板、订阅或直接打开节点域名</div>
                <div class="mono" style="margin-top:6px; color:#475569;">panel-xxx / sub / sg-v4</div>
              </div>
            </div>
          </div>
          <div style="margin-top:14px; padding:10px; background:#eff6ff; border-radius:8px; font-size:12px; color:#1e3a8a;">
            所有出站流量均伪装为标准 TLS 443 / QUIC 443 流量
          </div>
        </div>

        <!-- Column 2: Edge Gateways -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card" style="flex:1; border:2px solid #2563eb;">
            <div class="card-title"><span class="dot blue"></span>Nginx Stream (TCP 443)</div>
            <div style="font-size:12.5px; color:#475569; margin-bottom:10px;">
              启用 <span class="mono pill blue">ssl_preread on</span><br/>仅读取 TLS 握手 SNI，不解密流量
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border-left:3px solid #16a34a;">
                <div class="mono" style="font-weight:700;">sg-v4 / sg-v6</div>
                <div style="color:#475569;">→ VLESS TCP Reality</div>
              </div>
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border-left:3px solid #0d9488;">
                <div class="mono" style="font-weight:700;">sg-x</div>
                <div style="color:#475569;">→ VLESS XHTTP Reality</div>
              </div>
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border-left:3px solid #7c3aed;">
                <div class="mono" style="font-weight:700;">其他全部域名 (default)</div>
                <div style="color:#475569;">→ 本机 Nginx HTTPS (8443)</div>
              </div>
            </div>
          </div>

          <div class="card" style="border:2px solid #ea580c;">
            <div class="card-title"><span class="dot orange"></span>UDP 443 &amp; 端口跳跃</div>
            <div style="font-size:12.5px; color:#475569; line-height:1.55;">
              <div><span class="pill amber mono">UDP 20000-50000</span></div>
              <div style="margin:6px 0; font-weight:700; color:#c2410c;">↓ iptables DNAT 自动转发</div>
              <div><span class="pill orange mono" style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa;">UDP 443 → Xray Hysteria2</span></div>
              <div style="margin-top:6px; font-size:12px; color:#64748b;">直接绑定内网 IPv4 (BIND4) 与公网 IPv6，不经过 nginx</div>
            </div>
          </div>
        </div>

        <!-- Column 3: Localhost 127.0.0.1 Services -->
        <div class="card" style="background:#ffffff;">
          <div class="card-title">
            <span class="dot green"></span>服务器内部服务（全部仅监听 <span class="mono" style="color:#15803d;">127.0.0.1</span>，公网不可直连）
          </div>

          <!-- Xray group -->
          <div style="border:1px solid #bbf7d0; background:#f0fdf4; border-radius:10px; padding:12px 14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:800; font-size:13.5px; color:#166534;">Xray-core 代理入站（由 3x-ui 管理）</span>
              <span class="pill green">Reality 自偷回落 → 127.0.0.1:8443</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12.5px;">
              <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid #dcfce7;">
                <div style="font-weight:700;">VLESS + TCP + Reality + Vision</div>
                <div class="mono" style="color:#15803d; margin-top:2px;">127.0.0.1:10000 (v4) / 10010 (v6)</div>
              </div>
              <div style="background:#fff; padding:8px 10px; border-radius:8px; border:1px solid #dcfce7;">
                <div style="font-weight:700;">VLESS + XHTTP + Reality + 加密</div>
                <div class="mono" style="color:#0f766e; margin-top:2px;">127.0.0.1:10009 (v4) / 10019 (v6)</div>
              </div>
            </div>
          </div>

          <!-- Nginx 8443 group -->
          <div style="border:1px solid #ddd6fe; background:#faf5ff; border-radius:10px; padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span style="font-weight:800; font-size:13.5px; color:#5b21b6;">Nginx HTTPS (127.0.0.1:8443) · 通配符证书 *.example.com</span>
              <span class="pill purple">TLS 终结 + 反代</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:9px; font-size:12.5px;">
              <div style="background:#fff; padding:10px 12px; border-radius:8px; border:1px solid #e9d5ff;">
                <div style="font-weight:700; color:#1d4ed8;">订阅网站 (sub.example.com)</div>
                <div class="mono" style="color:#475569; margin-top:3px;">/sub/ → 127.0.0.1:2096</div>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">3x-ui 订阅服务，加密下发全部节点</div>
              </div>
              <div style="background:#fff; padding:10px 12px; border-radius:8px; border:1px solid #e9d5ff;">
                <div style="font-weight:700; color:#0f766e;">伪装博客页 (sg-v4 / sg-v6 / sg-x)</div>
                <div class="mono" style="color:#475569; margin-top:3px;">/ → /var/www/site/index.html</div>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">Reality 回落页 &amp; Hy2 伪装共享目录</div>
              </div>
              <div style="background:#fff; padding:10px 12px; border-radius:8px; border:1px solid #e9d5ff;">
                <div style="font-weight:700; color:#b45309;">3x-ui 管理面板 (panel-xxx.)</div>
                <div class="mono" style="color:#475569; margin-top:3px;">/随机路径/ → 127.0.0.1:54321</div>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">直接访问根路径返回 404，防扫描</div>
              </div>
              <div style="background:#fff; padding:10px 12px; border-radius:8px; border:1px solid #c4b5fd; box-shadow: 0 0 0 1px #c4b5fd;">
                <div style="font-weight:700; color:#6d28d9;">CPA 开源项目 (api.example.com)</div>
                <div class="mono" style="color:#475569; margin-top:3px;">/ → 127.0.0.1:8317 (Docker)</div>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">OAuth 代理 Claude/Codex/Gemini 为 API</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="alert info">
        <span class="alert-tag">安全设计</span>
        <div>公网扫描服务器 IP 时，只能看到 <strong>TCP 22 / 80 / 443</strong> 和 <strong>UDP 443</strong>；直接访问节点域名会返回真实 HTTPS 证书 + 正常静态网页（Reality 自偷），无需借用 Cloudflare / Apple 等第三方网站。</div>
      </div>
    </div>
    `,
  },

  // 2. Lightsail Instance + Firewall
  {
    name: "02-lightsail-firewall-setup.png",
    height: 700,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part">Part 1 · 第二步</span>
          <h1>AWS Lightsail 实例选型、静态 IP 与防火墙规则</h1>
          <div class="subtitle">创建实例后务必先绑定 Static IP，再同时配置 IPv4 与 IPv6 两套防火墙</div>
        </div>
        <div class="header-right">AWS Lightsail · Singapore · Debian 12</div>
      </div>

      <div style="display:grid; grid-template-columns: 360px 1fr; gap: 20px;">
        <!-- Left: Instance Specs -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card">
            <div class="card-title"><span class="dot orange"></span>推荐实例配置</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:13.5px;">
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid #f1f5f9;">
                <span style="color:#64748b;">地区 Region</span>
                <span style="font-weight:700;">Singapore (ap-southeast-1)</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid #f1f5f9;">
                <span style="color:#64748b;">系统 Blueprint</span>
                <span style="font-weight:700;">OS Only → Debian 12</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid #f1f5f9;">
                <span style="color:#64748b;">套餐 Plan</span>
                <span class="pill blue">$12/月 · 2GB / 2vCPU / 3TB</span>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid #f1f5f9;">
                <span style="color:#64748b;">网络栈</span>
                <span style="font-weight:700;">Dual-stack (IPv4 + IPv6)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:#64748b;">默认 SSH 用户</span>
                <span class="mono pill slate">admin + .pem 密钥</span>
              </div>
            </div>
          </div>

          <div class="card" style="background:#fffbeb; border-color:#fde68a;">
            <div class="card-title" style="color:#92400e;"><span class="dot orange"></span>必做：绑定 Static IP</div>
            <div style="font-size:13px; color:#78350f; line-height:1.6;">
              <div>1. 进入实例 → <strong>Networking</strong></div>
              <div>2. 点击 <strong>Create static IP</strong> 并绑定当前实例</div>
              <div>3. 绑定是免费的（挂载在运行实例上不额外收费）</div>
              <div style="margin-top:6px; font-weight:700; color:#b45309;">不绑定则实例重启后公网 IP 会变，所有 DNS 记录失效！</div>
            </div>
          </div>
        </div>

        <!-- Right: Firewall Mockup -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div class="card-title" style="margin-bottom:0;"><span class="dot blue"></span>Networking → 防火墙放行端口表</div>
            <div>
              <span class="pill blue">IPv4 Firewall</span>
              <span class="pill purple" style="margin-left:6px;">IPv6 Firewall（也要配！）</span>
            </div>
          </div>

          <table class="clean">
            <thead>
              <tr>
                <th>应用 / 协议</th>
                <th>协议类型</th>
                <th>端口范围</th>
                <th>用途说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>SSH</strong></td>
                <td><span class="pill slate">TCP</span></td>
                <td class="mono" style="font-weight:700;">22</td>
                <td>密钥远程登录 &amp; 第四步 OAuth SSH 隧道</td>
              </tr>
              <tr>
                <td><strong>HTTP</strong></td>
                <td><span class="pill slate">TCP</span></td>
                <td class="mono" style="font-weight:700;">80</td>
                <td>301 自动跳转到 HTTPS</td>
              </tr>
              <tr style="background:#eff6ff;">
                <td><strong>HTTPS / Reality / CPA</strong></td>
                <td><span class="pill blue">TCP</span></td>
                <td class="mono" style="font-weight:700; color:#1d4ed8;">443</td>
                <td>核心入口：nginx SNI 分流、代理、订阅、CPA</td>
              </tr>
              <tr style="background:#fff7ed;">
                <td><strong>Hysteria2 主端口</strong></td>
                <td><span class="pill amber">UDP</span></td>
                <td class="mono" style="font-weight:700; color:#b45309;">443</td>
                <td>QUIC/UDP 高速代理主端口</td>
              </tr>
              <tr style="background:#fff7ed;">
                <td><strong>Hysteria2 端口跳跃</strong></td>
                <td><span class="pill amber">UDP</span></td>
                <td class="mono" style="font-weight:700; color:#b45309;">20000 - 50000</td>
                <td>通过 iptables DNAT 到 UDP 443，抗 QoS 限速</td>
              </tr>
            </tbody>
          </table>

          <div class="alert warn">
            <span class="alert-tag">注意内网 IP</span>
            <div>AWS 网卡（如 <span class="mono">ens5</span>）上绑的是<strong>内网 IPv4</strong>（如 <span class="mono">172.26.x.x</span>），不是公网静态 IP。配 Hysteria2 监听与 <span class="mono">iptables DNAT</span> 时要填内网 IPv4，配 DNS 时填公网静态 IPv4。</div>
          </div>
        </div>
      </div>

      <div class="alert ok">
        <span class="alert-tag">初始化提醒</span>
        <div>连上 SSH 后先完成三件事：① 安装 <span class="mono">nginx + libnginx-mod-stream + Docker</span>；② 开启 <strong>BBR</strong> 拥塞控制；③ 创建 <strong>4 GB Swap</strong> 防止后续 Docker 运行内存不足。同时在 AWS Billing 里设置 <strong>$15 预算邮件告警</strong>。</div>
      </div>
    </div>
    `,
  },

  // 3. Spaceship DNS + Wildcard Cert
  {
    name: "03-spaceship-dns-cert.png",
    height: 645,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part">Part 1 · 第三步</span>
          <h1>Spaceship 域名 DNS 规划与通配符证书申请流程</h1>
          <div class="subtitle">六个子域名按职责拆分，全都不开 CDN；用 Spaceship API 一次签发 *.example.com 全站通用证书</div>
        </div>
        <div class="header-right">Spaceship DNS + Let's Encrypt DNS-01</div>
      </div>

      <div style="display:grid; grid-template-columns: 1.35fr 1fr; gap: 20px;">
        <!-- Left: DNS Table -->
        <div class="card">
          <div class="card-title"><span class="dot blue"></span>Spaceship DNS 记录清单（example.com）</div>
          <table class="clean">
            <thead>
              <tr>
                <th>Host 子域名</th>
                <th>类型</th>
                <th>指向目标</th>
                <th>关键规则</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="mono" style="font-weight:700;">sg-v4</td>
                <td><span class="pill blue">仅 A</span></td>
                <td class="mono">&lt;公网IPv4&gt;</td>
                <td><span class="pill red">不要加 AAAA</span> 强制走 v4</td>
              </tr>
              <tr>
                <td class="mono" style="font-weight:700;">sg-v6</td>
                <td><span class="pill purple">仅 AAAA</span></td>
                <td class="mono">&lt;公网IPv6&gt;</td>
                <td><span class="pill red">不要加 A</span> 强制走 v6</td>
              </tr>
              <tr>
                <td class="mono" style="font-weight:700;">sg-x</td>
                <td><span class="pill green">A + AAAA</span></td>
                <td class="mono">IPv4 &amp; IPv6</td>
                <td>XHTTP Reality 双栈共用 SNI</td>
              </tr>
              <tr>
                <td class="mono" style="font-weight:700;">sub</td>
                <td><span class="pill blue">A</span></td>
                <td class="mono">&lt;公网IPv4&gt;</td>
                <td>3x-ui 订阅网站域名</td>
              </tr>
              <tr>
                <td class="mono" style="font-weight:700;">panel-abc123</td>
                <td><span class="pill amber">A</span></td>
                <td class="mono">&lt;公网IPv4&gt;</td>
                <td>3x-ui 面板（改随机难猜名）</td>
              </tr>
              <tr>
                <td class="mono" style="font-weight:700;">api</td>
                <td><span class="pill purple">A</span></td>
                <td class="mono">&lt;公网IPv4&gt;</td>
                <td>CPA 开源项目对外域名</td>
              </tr>
            </tbody>
          </table>
          <div class="alert info" style="margin-top:12px;">
            <span class="alert-tag">提示</span>
            <div>全部记录<strong>直连服务器 IP，不开任何 CDN 代理</strong>；TTL 设 300 秒方便快速生效。</div>
          </div>
        </div>

        <!-- Right: Certbot DNS-01 Flow -->
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-title"><span class="dot green"></span>通配符证书自动申请与续期</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 13px;">
                <div style="font-weight:700; color:#1e40af;">① Spaceship 后台创建 API 密钥</div>
                <div style="color:#475569; margin-top:3px;">API Manager → New API key，权限仅勾 <span class="mono">dnsrecords:read</span> 与 <span class="mono">dnsrecords:write</span></div>
              </div>
              <div style="text-align:center; color:#94a3b8; font-weight:800;">↓</div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:11px 13px;">
                <div style="font-weight:700; color:#15803d;">② 服务器写入凭据 &amp; 运行 Certbot</div>
                <div class="mono" style="color:#334155; margin-top:4px; font-size:12px;">/etc/letsencrypt/spaceship.ini (chmod 600)</div>
                <div style="color:#475569; margin-top:3px;">使用 <span class="mono">certbot-dns-spaceship</span> 等待 120s 自动验证 TXT 记录</div>
              </div>
              <div style="text-align:center; color:#94a3b8; font-weight:800;">↓</div>
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:11px 13px;">
                <div style="font-weight:700; color:#166534;">③ 产出 *.example.com 证书 + 定时续期</div>
                <div class="mono" style="color:#15803d; margin-top:3px; font-size:12px;">/etc/letsencrypt/live/example.com/</div>
                <div style="color:#475569; margin-top:3px;"><span class="mono">certbot.timer</span> 每日检查两次，续期后自动重载 nginx &amp; 重启 x-ui</div>
              </div>
            </div>
          </div>

          <div class="alert warn" style="margin-top:12px;">
            <span class="alert-tag">避坑</span>
            <div>刚签完证书 1 小时内别跑 <span class="mono">--dry-run</span>，旧 TXT 缓存未过会误报失败。</div>
          </div>
        </div>
      </div>
    </div>
    `,
  },

  // 4. 3x-ui & v2rayN Flow
  {
    name: "04-3xui-v2rayn-flow.png",
    height: 690,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part">Part 1 · 第四至六步</span>
          <h1>3x-ui 三协议节点配置要点与 v2rayN 订阅接入</h1>
          <div class="subtitle">服务端按协议建入站 + 开启订阅网站；Windows 端用 v2rayN 导入订阅并补填 Hysteria2 端口跳跃</div>
        </div>
        <div class="header-right">3x-ui (MHSanaei) → v2rayN 7.24+</div>
      </div>

      <div style="display:grid; grid-template-columns: 1.15fr 1fr; gap: 20px;">
        <!-- Left: 3x-ui 3 Inbounds -->
        <div class="card">
          <div class="card-title"><span class="dot green"></span>3x-ui 核心入站配置对照（IPv4 为例）</div>
          <div style="display:flex; flex-direction:column; gap:11px;">
            <div style="border:1px solid #bfdbfe; background:#f8fbff; border-radius:10px; padding:12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#1d4ed8; font-size:13.5px;">节点 1：VLESS + TCP + Reality + Vision（主力）</strong>
                <span class="pill blue mono">127.0.0.1:10000</span>
              </div>
              <div style="font-size:12.5px; color:#334155; margin-top:6px; line-height:1.6;">
                • Flow 必填：<span class="mono pill slate">xtls-rprx-vision</span>（留空会暴露 TLS 嵌套特征）<br/>
                • Target：<span class="mono">127.0.0.1:8443</span> ｜ SNI：<span class="mono">sg-v4.example.com</span><br/>
                • <strong>外部地址 Hosts</strong>：<span class="mono" style="color:#dc2626; font-weight:700;">sg-v4.example.com:443</span>
              </div>
            </div>

            <div style="border:1px solid #99f6e4; background:#f0fdfa; border-radius:10px; padding:12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#0f766e;">节点 2：VLESS + XHTTP + Reality（抗干扰进阶）</strong>
                <span class="pill green mono">127.0.0.1:10009</span>
              </div>
              <div style="font-size:12.5px; color:#334155; margin-top:6px; line-height:1.6;">
                • Mode 选 <span class="mono pill slate">auto</span>（不选 packet-up），可开启 VLESS Encryption<br/>
                • Target：<span class="mono">127.0.0.1:8443</span> ｜ SNI：<span class="mono">sg-x.example.com</span><br/>
                • <strong>外部地址 Hosts</strong>：<span class="mono" style="color:#dc2626; font-weight:700;">sg-v4.example.com:443</span>（地址定线路，SNI 定分流）
              </div>
            </div>

            <div style="border:1px solid #fed7aa; background:#fffaf5; border-radius:10px; padding:12px 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#c2410c;">节点 3：Hysteria2（晚高峰高速 UDP）</strong>
                <span class="pill amber mono">&lt;BIND4&gt;:443/UDP</span>
              </div>
              <div style="font-size:12.5px; color:#334155; margin-top:6px; line-height:1.6;">
                • 监听填<strong>内网 IPv4</strong>，证书填 <span class="mono">/etc/letsencrypt/live/example.com/</span><br/>
                • 伪装 Masquerade 指向 <span class="mono">/var/www/site</span>，<strong>不开 Salamander</strong><br/>
                • 配合系统层 <span class="mono">hy2-porthop.service</span> 转发 UDP 20000-50000
              </div>
            </div>
          </div>
        </div>

        <!-- Right: v2rayN UI Mockup -->
        <div class="card" style="background:#f8fafc;">
          <div class="card-title"><span class="dot blue"></span>Windows 客户端 v2rayN 配置示意</div>

          <!-- Mock window -->
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; overflow:hidden;">
            <div style="background:#1e293b; color:#f8fafc; padding:8px 12px; font-size:12px; display:flex; justify-content:space-between;">
              <span>v2rayN v7.25+ (Windows x64)</span>
              <span style="color:#94a3b8;">订阅分组 ▾ · 设置 ▾</span>
            </div>
            <div style="padding:12px; font-size:12.5px;">
              <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:9px 11px; margin-bottom:10px;">
                <div style="font-weight:700; color:#1e40af;">① 添加订阅分组 URL</div>
                <div class="mono" style="margin-top:3px; color:#1d4ed8; word-break:break-all;">https://sub.example.com/sub/&lt;你的订阅ID&gt;</div>
                <div style="font-size:11.5px; color:#475569; margin-top:3px;">点击「更新全部订阅（不通过代理）」自动拉取全部节点</div>
              </div>

              <div style="border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:10px;">
                <div style="font-weight:700; color:#334155; margin-bottom:6px;">② 节点列表（Ctrl+R 真连接测速）</div>
                <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f0fdf4; border-radius:5px; margin-bottom:4px;">
                  <span>✔ SG-v4-Reality-Vision</span>
                  <span class="mono" style="color:#16a34a; font-weight:700;">82 ms</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:4px 6px; margin-bottom:4px;">
                  <span>&nbsp;&nbsp; SG-v4-XHTTP-Reality</span>
                  <span class="mono" style="color:#16a34a;">88 ms</span>
                </div>
                <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#fffbeb; border-radius:5px;">
                  <span>&nbsp;&nbsp; SG-v4-Hysteria2 <strong style="color:#b45309;">[手动填 20000-50000]</strong></span>
                  <span class="mono" style="color:#16a34a;">75 ms</span>
                </div>
              </div>

              <!-- Status bar mockup -->
              <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:9px 10px;">
                <div style="font-weight:700; font-size:12px; color:#0f172a; margin-bottom:6px;">③ 底部状态栏核心开关</div>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  <span class="pill blue">系统代理：自动配置</span>
                  <span class="pill green">路由：绕过大陆</span>
                  <span class="pill slate mono">混合端口：10808</span>
                  <span class="pill amber">TUN：需管理员运行</span>
                </div>
              </div>
            </div>
          </div>

          <div class="alert warn" style="margin-top:12px;">
            <span class="alert-tag">常见疑问</span>
            <div>本地宽带没有 IPv6 时，<strong>v6 节点测速超时是正常的</strong>，直接选用 v4 节点即可；想让命令行终端也走代理，需以管理员身份启动 v2rayN 再开 TUN。</div>
          </div>
        </div>
      </div>
    </div>
    `,
  },

  // 5. CPA Deployment Stack
  {
    name: "05-cpa-deployment-stack.png",
    height: 670,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part">Part 1 · 第七步</span>
          <h1>开源项目 CPA (CLIProxyAPI) 容器部署与反代要点</h1>
          <div class="subtitle">将 Claude / Codex / Gemini 订阅账号包装为标准 API；区分管理密钥与 API Key，并关闭 Nginx 缓冲保障流式输出</div>
        </div>
        <div class="header-right">/opt/cliproxyapi · Docker + Nginx</div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Left: Docker & Config -->
        <div class="card">
          <div class="card-title"><span class="dot purple"></span>Docker 容器映射 &amp; 目录结构</div>
          <div style="background:#0f172a; color:#e2e8f0; border-radius:10px; padding:14px 16px; font-family:'Cascadia Code',Consolas,monospace; font-size:12.5px; line-height:1.65;">
            <div style="color:#94a3b8;">/opt/cliproxyapi/</div>
            <div>├── <span style="color:#93c5fd;">docker-compose.yml</span>  <span style="color:#64748b;"># eceasy/cli-proxy-api</span></div>
            <div>├── <span style="color:#fde047;">config.yaml</span>         <span style="color:#64748b;"># chmod 600 密钥配置</span></div>
            <div>├── <span style="color:#86efac;">auths/</span>              <span style="color:#64748b;"># OAuth 凭证 (自动刷新)</span></div>
            <div>└── <span style="color:#cbd5e1;">logs/ &amp; plugins/</span></div>
          </div>

          <div style="margin-top:14px;">
            <div style="font-weight:700; font-size:13.5px; margin-bottom:8px;">仅绑定 127.0.0.1 的四个端口</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12.5px;">
              <div style="background:#f5f3ff; border:1px solid #ddd6fe; padding:8px 10px; border-radius:8px;">
                <div class="mono" style="font-weight:700; color:#6d28d9;">127.0.0.1:8317</div>
                <div style="color:#475569;">API 接口 &amp; 管理后台</div>
              </div>
              <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:8px 10px; border-radius:8px;">
                <div class="mono" style="font-weight:700; color:#1d4ed8;">127.0.0.1:54545</div>
                <div style="color:#475569;">Claude OAuth 回调</div>
              </div>
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px 10px; border-radius:8px;">
                <div class="mono" style="font-weight:700; color:#15803d;">127.0.0.1:1455</div>
                <div style="color:#475569;">Codex OAuth 回调</div>
              </div>
              <div style="background:#fffbeb; border:1px solid #fde68a; padding:8px 10px; border-radius:8px;">
                <div class="mono" style="font-weight:700; color:#b45309;">127.0.0.1:8085</div>
                <div style="color:#475569;">Gemini OAuth 回调</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Keys & Nginx Streaming -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card">
            <div class="card-title"><span class="dot red"></span>千万别混用两个密钥！</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:9px; padding:10px 12px;">
                <div style="font-weight:700; color:#166534;">1. 客户端调用 Key（<span class="mono">access.api-keys</span>）</div>
                <div style="color:#334155; margin-top:3px;">形如 <span class="mono">sk-cpa-xxxx</span>，填进 <strong>CC Switch / Claude Code / curl</strong> 使用。</div>
              </div>
              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:9px; padding:10px 12px;">
                <div style="font-weight:700; color:#991b1b;">2. 管理后台密钥（<span class="mono">management.secret-key</span>）</div>
                <div style="color:#334155; margin-top:3px;">仅用于登录 <span class="mono">/management.html</span>；启动后自动转为 bcrypt 哈希，<strong>连续输错几次会被封 IP 返回 403</strong>。</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title"><span class="dot blue"></span>Nginx 反代 AI 流式输出必备参数</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12.5px;">
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                <div class="mono" style="font-weight:700; color:#1d4ed8;">proxy_buffering off;</div>
                <div style="color:#475569; margin-top:2px;">关闭缓冲，防字一块一块卡顿输出</div>
              </div>
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                <div class="mono" style="font-weight:700; color:#1d4ed8;">proxy_read_timeout 1h;</div>
                <div style="color:#475569; margin-top:2px;">延长超时，防止深度思考中途断流</div>
              </div>
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                <div class="mono" style="font-weight:700; color:#1d4ed8;">client_max_body_size 50m;</div>
                <div style="color:#475569; margin-top:2px;">支持大上下文与多图上传</div>
              </div>
              <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0;">
                <div class="mono" style="font-weight:700; color:#1d4ed8;">proxy_http_version 1.1;</div>
                <div style="color:#475569; margin-top:2px;">保留长连接与 SSE 流传输</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="alert ok">
        <span class="alert-tag">对外入口</span>
        <div>管理后台：<span class="mono">https://api.example.com/management.html</span> &nbsp;|&nbsp; OpenAI 客户端地址：<span class="mono">https://api.example.com/v1</span> &nbsp;|&nbsp; Claude Code 地址：<span class="mono">https://api.example.com</span>（不带 /v1）</div>
      </div>
    </div>
    `,
  },

  // 6. Mullvad Anti-Fraud + Proxy Setup
  {
    name: "06-mullvad-proxy-antifraud.png",
    height: 675,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part purple">Part 2 · 第一至三步</span>
          <h1>Claude Pro 注册防风控三要素与 Mullvad 代理配置</h1>
          <div class="subtitle">保证 IP、银行卡与账单地址三地一致；在 Mullvad 中务必排除 localhost 代理，避免 OAuth 回调失败</div>
        </div>
        <div class="header-right">Mullvad Browser + v2rayN (SOCKS5 10808)</div>
      </div>

      <!-- Top Row: 3 Alignment Factors -->
      <div class="card" style="margin-bottom:18px; background:linear-gradient(90deg,#f5f3ff 0%,#eff6ff 50%,#f0fdf4 100%);">
        <div class="card-title"><span class="dot purple"></span>防风控核心：三地严格一致（以新加坡 Lightsail 为例）</div>
        <div style="display:grid; grid-template-columns:1fr 36px 1fr 36px 1fr; align-items:center; gap:6px; text-align:center;">
          <div style="background:#fff; border:1.5px solid #c4b5fd; border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:#6d28d9; font-weight:700;">要素 1 · 代理出口 IP</div>
            <div style="font-size:16px; font-weight:800; margin:4px 0;">新加坡 (SG)</div>
            <div style="font-size:12px; color:#475569;">v2rayN 连自建 SG-v4 节点<br/>干净独享 IP，无 WebRTC 泄露</div>
          </div>
          <div style="font-size:22px; font-weight:900; color:#6366f1;">=</div>
          <div style="background:#fff; border:1.5px solid #93c5fd; border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:#1d4ed8; font-weight:700;">要素 2 · 支付银行卡</div>
            <div style="font-size:16px; font-weight:800; margin:4px 0;">新加坡发行卡</div>
            <div style="font-size:12px; color:#475569;">同地区 Visa / Mastercard<br/>开启境外支付，余额 ≥ $22</div>
          </div>
          <div style="font-size:22px; font-weight:900; color:#10b981;">=</div>
          <div style="background:#fff; border:1.5px solid #86efac; border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:#15803d; font-weight:700;">要素 3 · 账单地址</div>
            <div style="font-size:16px; font-weight:800; margin:4px 0;">Singapore 邮编地址</div>
            <div style="font-size:12px; color:#475569;">Stripe 结算页国家选 SG<br/>搭配 Gmail / Outlook + 海外手机号</div>
          </div>
        </div>
      </div>

      <!-- Bottom Row: Mullvad Settings UI Mockup + Checklist -->
      <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap: 20px;">
        <div class="card" style="background:#f8fafc;">
          <div class="card-title"><span class="dot blue"></span>Mullvad Browser → Settings → Proxy 填法</div>
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; padding:14px 16px; font-size:13px;">
            <div style="font-weight:700; margin-bottom:10px; color:#1e293b;">Connection Settings（手动 SOCKS5 方式）</div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <span style="display:inline-block; width:14px; height:14px; border-radius:50%; border:4px solid #2563eb;"></span>
              <strong>Manual proxy configuration</strong>
              <span style="font-size:12px; color:#64748b;">（或直接选 Use system proxy settings）</span>
            </div>
            <div style="display:grid; grid-template-columns: 95px 1fr 55px 80px; gap:8px; align-items:center; margin-bottom:10px;">
              <span style="color:#475569;">SOCKS Host</span>
              <span class="mono" style="border:1px solid #94a3b8; border-radius:5px; padding:5px 8px; background:#f8fafc;">127.0.0.1</span>
              <span style="color:#475569; text-align:right;">Port</span>
              <span class="mono" style="border:1px solid #94a3b8; border-radius:5px; padding:5px 8px; background:#f8fafc; font-weight:700;">10808</span>
            </div>
            <div style="display:flex; gap:18px; margin-bottom:12px; font-size:12.5px;">
              <span>◉ <strong>SOCKS v5</strong></span>
              <span style="color:#15803d; font-weight:700;">☑ Proxy DNS when using SOCKS v5（必勾！）</span>
            </div>
            <div style="border:2px solid #dc2626; background:#fef2f2; border-radius:8px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <strong style="color:#991b1b;">No proxy for（关键避坑框！）</strong>
                <span class="pill red">不填会导致 OAuth 回调超时</span>
              </div>
              <div class="mono" style="background:#ffffff; border:1px solid #fca5a5; border-radius:5px; padding:6px 10px; font-weight:700; color:#0f172a;">
                localhost, 127.0.0.1
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-title"><span class="dot green"></span>注册前两项必检 + 操作守则</div>
            <div style="display:flex; flex-direction:column; gap:10px; font-size:13px;">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:9px; padding:10px 12px;">
                <div class="mono" style="font-weight:700; color:#15803d;">1. https://ipinfo.io/json</div>
                <div style="color:#334155; margin-top:2px;">确认 IP 是你的 Lightsail 公网 IP，且 <span class="mono">country</span> 与发卡国一致</div>
              </div>
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:9px; padding:10px 12px;">
                <div class="mono" style="font-weight:700; color:#15803d;">2. https://browserleaks.com/webrtc</div>
                <div style="color:#334155; margin-top:2px;">确认无国内真实 IP 泄露（Mullvad 默认禁用 WebRTC）</div>
              </div>
              <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:9px; padding:10px 12px;">
                <div style="font-weight:700; color:#b45309;">3. 充值完成后先别关浏览器！</div>
                <div style="color:#78350f; margin-top:2px;">Mullvad 关闭即清空所有 Cookie；订阅 Pro 成功后保持窗口打开，直接去下一步做 OAuth 授权。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    `,
  },

  // 7. SSH Tunnel + OAuth Sequence Diagram
  {
    name: "07-oauth-ssh-tunnel-sequence.png",
    height: 750,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part purple">Part 2 · 第四步</span>
          <h1>SSH 隧道打通 CPA 的 Claude OAuth 授权回调全流程</h1>
          <div class="subtitle">为什么需要 SSH 隧道？因为浏览器授权后只会回调本机 localhost:54545，而接收回调的 CPA 运行在远程服务器上</div>
        </div>
        <div class="header-right">ssh -L 54545:127.0.0.1:54545 lightsail</div>
      </div>

      <div class="card" style="padding:20px 22px;">
        <svg viewBox="0 0 1084 480" width="1084" height="480" xmlns="http://www.w3.org/2000/svg" style="display:block; margin:0 auto;">
          <defs>
            <marker id="arr-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb"/>
            </marker>
            <marker id="arr-purple" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed"/>
            </marker>
            <marker id="arr-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#16a34a"/>
            </marker>
            <marker id="arr-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ea580c"/>
            </marker>
          </defs>

          <!-- Actor Headers -->
          <rect x="10" y="10" width="210" height="58" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
          <text x="115" y="34" text-anchor="middle" font-size="14" font-weight="800" fill="#1e40af">本机 Mullvad 浏览器</text>
          <text x="115" y="54" text-anchor="middle" font-size="11.5" fill="#475569">已登录 Claude Pro</text>

          <rect x="292" y="10" width="210" height="58" rx="10" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/>
          <text x="397" y="34" text-anchor="middle" font-size="14" font-weight="800" fill="#c2410c">本机终端 SSH 隧道</text>
          <text x="397" y="54" text-anchor="middle" font-size="11.5" font-family="Consolas,monospace" fill="#7c2d12">127.0.0.1:54545</text>

          <rect x="574" y="10" width="220" height="58" rx="10" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/>
          <text x="684" y="34" text-anchor="middle" font-size="14" font-weight="800" fill="#5b21b6">Lightsail 服务器 CPA</text>
          <text x="684" y="54" text-anchor="middle" font-size="11.5" font-family="Consolas,monospace" fill="#4c1d95">api.example.com / :54545</text>

          <rect x="866" y="10" width="208" height="58" rx="10" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/>
          <text x="970" y="34" text-anchor="middle" font-size="14" font-weight="800" fill="#166534">Anthropic OAuth 官方</text>
          <text x="970" y="54" text-anchor="middle" font-size="11.5" fill="#15803d">claude.ai 授权服务器</text>

          <!-- Lifelines -->
          <line x1="115" y1="68" x2="115" y2="465" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,5"/>
          <line x1="397" y1="68" x2="397" y2="465" stroke="#fdba74" stroke-width="2" stroke-dasharray="6,5"/>
          <line x1="684" y1="68" x2="684" y2="465" stroke="#c4b5fd" stroke-width="2" stroke-dasharray="6,5"/>
          <line x1="970" y1="68" x2="970" y2="465" stroke="#86efac" stroke-width="2" stroke-dasharray="6,5"/>

          <!-- Step 1: SSH Tunnel -->
          <rect x="330" y="92" width="420" height="34" rx="8" fill="#fff7ed" stroke="#ea580c" stroke-width="1.5"/>
          <text x="540" y="114" text-anchor="middle" font-size="12.5" font-weight="700" fill="#c2410c">① 建立加密端口转发：ssh -L 54545:127.0.0.1:54545 lightsail</text>

          <!-- Step 2: Open management.html -->
          <line x1="115" y1="162" x2="674" y2="162" stroke="#2563eb" stroke-width="2.5" marker-end="url(#arr-blue)"/>
          <rect x="200" y="138" width="390" height="22" rx="4" fill="#ffffff"/>
          <text x="395" y="153" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1e40af">② 打开 https://api.example.com/management.html 生成 Claude 授权链接</text>

          <!-- Step 3: Authorize on Anthropic -->
          <line x1="115" y1="220" x2="960" y2="220" stroke="#7c3aed" stroke-width="2.5" marker-end="url(#arr-purple)"/>
          <rect x="340" y="196" width="420" height="22" rx="4" fill="#ffffff"/>
          <text x="550" y="211" text-anchor="middle" font-size="12.5" font-weight="700" fill="#5b21b6">③ 在同一个 Mullvad 窗口打开授权链接，点击 Authorize 同意授权</text>

          <!-- Step 4: Redirect to localhost:54545 -->
          <line x1="970" y1="276" x2="125" y2="276" stroke="#16a34a" stroke-width="2.5" stroke-dasharray="7,4" marker-end="url(#arr-green)"/>
          <rect x="340" y="252" width="440" height="22" rx="4" fill="#ffffff"/>
          <text x="560" y="267" text-anchor="middle" font-size="12.5" font-weight="700" fill="#15803d">④ 302 跳转回 http://localhost:54545/callback?code=...（不走代理！）</text>

          <!-- Step 5: Browser -> SSH Tunnel -> CPA -->
          <line x1="115" y1="336" x2="387" y2="336" stroke="#ea580c" stroke-width="2.5" marker-end="url(#arr-orange)"/>
          <text x="251" y="326" text-anchor="middle" font-size="12" font-weight="700" fill="#c2410c">⑤ 访问本机 54545</text>

          <line x1="397" y1="336" x2="674" y2="336" stroke="#ea580c" stroke-width="2.5" marker-end="url(#arr-orange)"/>
          <text x="536" y="326" text-anchor="middle" font-size="12" font-weight="700" fill="#c2410c">经 SSH 隧道转发到服务器 CPA</text>

          <!-- Step 6: CPA exchanges token & saves -->
          <line x1="684" y1="392" x2="960" y2="392" stroke="#7c3aed" stroke-width="2.2" marker-end="url(#arr-purple)"/>
          <text x="822" y="382" text-anchor="middle" font-size="12" font-weight="700" fill="#5b21b6">⑥ 用 code 换取 OAuth Token</text>

          <rect x="526" y="416" width="316" height="42" rx="8" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/>
          <text x="684" y="434" text-anchor="middle" font-size="12.5" font-weight="800" fill="#166534">✔ 凭证写入 /opt/cliproxyapi/auths/claude-*.json</text>
          <text x="684" y="451" text-anchor="middle" font-size="11.5" fill="#15803d">后续由 CPA 自动续期，可关闭 SSH 隧道和浏览器</text>
        </svg>
      </div>

      <div class="alert warn">
        <span class="alert-tag">遇到报错怎么办</span>
        <div>如果 Mullvad 拦截 HTTP 弹窗（HTTPS-Only Mode Alert），点 <strong>Continue to HTTP Site</strong> 放行；如果仍卡住，直接复制地址栏完整的 <span class="mono">http://localhost:54545/callback?...</span> 链接，在本机终端执行 <span class="mono">curl "&lt;粘贴链接&gt;"</span> 即可完成交接。</div>
      </div>
    </div>
    `,
  },

  // 8. CC Switch + Claude Code Integration
  {
    name: "08-cc-switch-claude-code.png",
    height: 645,
    html: `
    <div class="canvas">
      <div class="header">
        <div>
          <span class="badge-part purple">Part 2 · 第五步</span>
          <h1>将 CPA 接入 CC Switch 与 Claude Code 调用链路</h1>
          <div class="subtitle">在 CC Switch 中添加自定义供应商一键写入 ~/.claude/settings.json，注意 Claude Code 地址不要带 /v1</div>
        </div>
        <div class="header-right">CC Switch → Claude Code CLI</div>
      </div>

      <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap: 20px;">
        <!-- Left: CC Switch UI Mockup -->
        <div class="card" style="background:#f8fafc;">
          <div class="card-title"><span class="dot purple"></span>CC Switch 添加自定义供应商界面示意</div>
          <div style="background:#ffffff; border:1.5px solid #cbd5e1; border-radius:10px; overflow:hidden;">
            <div style="background:#1e1b4b; color:#ffffff; padding:9px 14px; font-size:12.5px; display:flex; justify-content:space-between;">
              <span><strong>CC Switch</strong> &nbsp;·&nbsp; 应用：<span style="background:#4f46e5; padding:2px 8px; border-radius:5px;">Claude Code</span></span>
              <span style="color:#a5b4fc;">添加供应商 → 自定义</span>
            </div>
            <div style="padding:14px 16px; display:flex; flex-direction:column; gap:11px; font-size:13px;">
              <div>
                <div style="font-weight:700; color:#334155; margin-bottom:4px;">供应商名称</div>
                <div class="mono" style="border:1px solid #cbd5e1; border-radius:6px; padding:7px 10px; background:#f8fafc;">Lightsail-CPA</div>
              </div>

              <div style="border:2px solid #dc2626; background:#fef2f2; border-radius:8px; padding:9px 11px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#991b1b;">Base URL（API 地址）</strong>
                  <span class="pill red">末尾千万不要带 /v1 !</span>
                </div>
                <div class="mono" style="background:#ffffff; border:1px solid #fca5a5; border-radius:6px; padding:7px 10px; font-weight:700;">https://api.example.com</div>
              </div>

              <div style="border:1.5px solid #93c5fd; background:#eff6ff; border-radius:8px; padding:9px 11px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#1e40af;">API Key / Auth Token</strong>
                  <span class="pill blue">填客户端 Key，不是管理密码</span>
                </div>
                <div class="mono" style="background:#ffffff; border:1px solid #bfdbfe; border-radius:6px; padding:7px 10px;">sk-cpa-xxxxxxxxxxxxxxxxxxxxxxxx</div>
              </div>

              <div>
                <div style="font-weight:700; color:#334155; margin-bottom:5px;">模型映射（按 /v1/models 实际返回填写）</div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:12px;">
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px;">
                    <div style="color:#64748b;">Opus 槽位</div>
                    <div class="mono" style="font-weight:700;">claude-opus-...</div>
                  </div>
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px;">
                    <div style="color:#64748b;">Sonnet 槽位</div>
                    <div class="mono" style="font-weight:700;">claude-sonnet-...</div>
                  </div>
                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px;">
                    <div style="color:#64748b;">Haiku 槽位</div>
                    <div class="mono" style="font-weight:700;">claude-haiku-...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Live Call Flow + Verification -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card">
            <div class="card-title"><span class="dot green"></span>启用后的完整请求链路</div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:10px 12px;">
                <strong>1. CC Switch 点「启用」</strong>
                <div style="color:#475569; font-size:12px; margin-top:2px;">自动写入 <span class="mono">~/.claude/settings.json</span> 环境变量</div>
              </div>
              <div style="text-align:center; color:#94a3b8; font-weight:800;">↓</div>
              <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:9px; padding:10px 12px;">
                <strong style="color:#1e40af;">2. 本机终端运行 Claude Code</strong>
                <div class="mono" style="color:#1d4ed8; font-size:12px; margin-top:2px;">claude -p "reply ok"</div>
              </div>
              <div style="text-align:center; color:#94a3b8; font-weight:800;">↓</div>
              <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:9px; padding:10px 12px;">
                <strong style="color:#5b21b6;">3. Lightsail 新加坡 CPA 转发</strong>
                <div style="color:#475569; font-size:12px; margin-top:2px;">固定新加坡 IP + 自动维护 OAuth Token，直连 Anthropic</div>
              </div>
            </div>
          </div>

          <div class="card" style="background:#f0fdf4; border-color:#bbf7d0;">
            <div class="card-title" style="color:#166534;"><span class="dot green"></span>验收与日常安全建议</div>
            <div style="font-size:12.5px; color:#14532d; line-height:1.65;">
              <div>• 终端秒回 <span class="mono">ok</span> 且服务器 CPA 日志有请求记录即成功</div>
              <div>• 平时尽量只走 API，少在不同节点/设备反复登网页版</div>
              <div>• 控制并发避免撞 5 小时额度 429 限流</div>
              <div>• 不要外泄 CPA 的 <span class="mono">sk-cpa-</span> key（分享给朋友请前置 New API）</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    `,
  },
];

for (const d of DIAGRAMS) {
  const htmlPath = path.join(TMP_DIR, d.name.replace(".png", ".html"));
  const outPath = path.join(OUT_DIR, d.name);
  fs.writeFileSync(htmlPath, wrapHtml(d.html), "utf8");
  const fileUrl = pathToFileURL(htmlPath).href;
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=1200,${d.height}`,
      `--screenshot=${outPath}`,
      fileUrl,
    ],
    { stdio: "pipe" }
  );
  const stat = fs.statSync(outPath);
  console.log(`Rendered ${d.name} (${Math.round(stat.size / 1024)} KB)`);
}

fs.rmSync(TMP_DIR, { recursive: true, force: true });
console.log("All diagrams rendered cleanly.");
