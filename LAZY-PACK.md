# AI 懒人包：一键部署 Lightsail 代理 + CPA 网关 + Claude Code

> **怎么用（给用户）**
>
> 1. 准备一个能执行终端命令的 AI 编程助手，例如 Claude Code、Codex CLI、Cursor Agent、Gemini CLI。网页聊天版 AI 不能执行命令，只能当说明书看。
> 2. 新建一个空文件夹，在里面打开你的 AI 助手，把本文件整份发给它，然后说：
>
>    ```text
>    请严格按照这份懒人包，从 P0 开始执行。能自动完成的你来做，需要我本人操作的地方停下来一步步教我。
>    ```
>
> 3. AI 会自己完成服务器配置、证书、代理节点、订阅、CPA 部署、浏览器代理配置、Claude Code 配置等工作。注册账号、付款、购买域名、在网页里点授权这几件事必须你本人做，AI 会停下来给你分步说明。
>
> **你需要提前准备**：常用邮箱（Gmail / Outlook）、能收短信的海外手机号、一张发卡地区受 Claude 支持的 Visa / Mastercard（开通境外支付）。全程约 1.5–2 小时。
> 每月费用约为：Lightsail `$12` + Claude Pro `$20` + 域名（首年 `$1–10`）。
>
> **合规提醒**：把网页订阅账号转为 API 使用通常不符合上游服务条款，存在限流或封号风险。本懒人包仅供学习与个人自用，请勿用于商业分发。
>
> 图文原版教程：[第一篇](docs/part1-server-proxy-cpa/README.md) ｜ [第二篇](docs/part2-claude-mullvad-ccswitch/README.md) ｜ [视频](https://leonhart999.github.io/lightsail-proxy-claude-guide/)

---

## 0. 给 AI 的执行守则（AI 必读，执行前先读完全文）

你是执行者。目标：按 P0 → P17 的顺序把整套服务部署好；能自动化的全部自己做，不能自动化的引导用户做。

1. **步骤标签**
   - `[AI]`：你直接执行，执行后必须验证。
   - `[用户]`：只有用户本人能做（注册、付款、购买、网页授权）。停下，按下文的“检查点格式”给出说明，等用户回复后再继续。
   - `[AI+用户]`：你先做准备（下载、复制到剪贴板、打开文件），再让用户完成剩下的点击。
2. **进度可续跑**：每完成一步，把步骤 ID 写进 `~/.lsg/state.json`（形如 `{"done": ["P0", "P1"], "notes": {}}`）。开始执行前先读这个文件，已完成的步骤只做快速验证，不要重做。
3. **密钥纪律**
   - 用户的密钥（Spaceship API Key 等）让用户自己写进 `~/.lsg/secrets.env`，不要让用户在聊天里粘贴。
   - 你生成的密钥也写进这个文件，权限 600。
   - 不要在回复里复述任何密码、密钥、Token、订阅 ID。需要告诉用户时，只说“已保存在 `~/.lsg/secrets.env` 的 `XXX` 一行”。
   - 把密钥传到服务器时，用 stdin 管道或 `ssh ... 'sudo tee 文件'`，不要写进要回显的命令输出。
   - 永远不要把密钥发给任何第三方服务。只允许发往用户自己的服务器、AWS、Spaceship、Anthropic 官方接口。
4. **先确认再执行**：以下操作执行前，先用一句话说明后果，等用户同意：
   - 创建 Lightsail 实例或静态 IP（开始计费）。
   - 覆盖已有防火墙规则。
   - 覆盖或修改用户已有的文件（先备份为 `.bak.时间戳`）。
   - 修改 `~/.claude/settings.json`。
   - 删除任何东西。
5. **如实汇报**：每一步都要用命令验证结果，验证不通过就不能说“成功”。失败时：
   - 先读错误信息，自行诊断并重试，最多 2 次。
   - 仍失败就把错误摘要和你的判断告诉用户，给出选项。
6. **版本差异**：3x-ui、CPA、v2rayN 更新很频繁。本文的字段和接口按 2026-11 的上游版本整理。遇到字段或接口不一致时，以服务器上实际安装版本的帮助、`openapi.json` 和 `config.example.yaml` 为准，按本文给出的“目标值”去适配，不要硬套。
7. **模板替换**：附录模板里的 `__DOMAIN__` 这类 `__大写__` 占位符，由你在本地用 `sed` 或 Python 替换后再上传。Nginx 配置里的 `$host`、`$ssl_preread_server_name` 等是 Nginx 变量，必须原样保留，不能被 shell 展开。
8. **本地网络**：用户可能在中国大陆，本机访问 GitHub 或 Docker Hub 可能失败。遇到下载失败时，改为在服务器上下载，再用 `scp` 拉回本地。服务器在海外，网络通畅。
9. **AWS 安全**：绝不使用 AWS 根用户访问密钥。只使用权限仅限 Lightsail 的 IAM 用户。
10. **沟通**：用中文，短句，每次只让用户做一件事。用户问“这一步在干嘛”时，用一两句话解释原理。

**检查点格式**（每个 `[用户]` 步骤都按这个格式输出）：

```text
【需要你操作 · 步骤 Px】
目的：……（一句话）
请按顺序做：
  1. ……
  2. ……
完成的标志：……
完成后回复我：「完成」（如需告诉我某个值，说明是哪个值；不要发密码或密钥）
```

---

## 1. 变量与文件约定

所有状态都放在用户主目录的 `~/.lsg/` 下（Windows 即 `C:\Users\<用户名>\.lsg\`）：

| 文件 | 内容 | 权限 |
| --- | --- | --- |
| `~/.lsg/vars.env` | 非机密变量（域名、IP、区域等） | 600 |
| `~/.lsg/secrets.env` | 机密变量（面板密码、CPA 密钥、Spaceship 密钥） | 600 |
| `~/.lsg/env.sh` | 加载上面两个文件的小脚本 | 600 |
| `~/.lsg/state.json` | 已完成步骤 | 600 |
| `~/.lsg/templates/` | 从本文附录保存的模板文件 | 700 |
| `~/.lsg/backup/` | 收尾时拉回的服务器备份 | 700 |

`vars.env` 的字段：

```bash
REGION=            # AWS 区域，如 ap-southeast-1
AZ=                # 可用区，如 ap-southeast-1a
NODE=              # 节点前缀，如 sg / jp / us，用于 sg-v4 这类子域名
INSTANCE=lsg-node  # Lightsail 实例名
DOMAIN=            # 你买的域名，如 example.com
PANEL_SUB=         # 3x-ui 面板子域名，P0 随机生成，如 panel-k3x9q2
PANEL_PATH=        # 3x-ui 面板根路径（不带斜杠），P0 随机生成
SUB_ID=            # 订阅 ID，P0 随机生成
XHTTP_PATH=        # XHTTP 路径（不带斜杠），P0 随机生成
PUB4=              # 静态公网 IPv4
PUB6=              # 公网 IPv6
BIND4=             # 网卡上的内网 IPv4（172.26.x.x）
NIC=               # 公网网卡名，通常是 ens5
LOCAL_PROXY_PORT=10808   # v2rayN 本地混合端口
MODEL_OPUS=        # P15 从 /v1/models 读出
MODEL_SONNET=
MODEL_HAIKU=
```

`secrets.env` 的字段：

```bash
XUI_USER=              # P0 生成
XUI_PASS=              # P0 生成
CPA_CLIENT_KEY=        # P0 生成，形如 sk-cpa-xxxx，给 Claude Code / CC Switch 用
CPA_MGMT_KEY=          # P0 生成，只用于登录 CPA 管理页
SPACESHIP_API_KEY=     # 用户在 P4 填写
SPACESHIP_API_SECRET=  # 用户在 P4 填写
```

之后每个本地命令块的第一行都执行 `. ~/.lsg/env.sh`。

---

## P0 [AI] 环境自检、生成随机值、问用户四个问题

**P0.1 检查本机环境**

识别操作系统（Windows 用 Git Bash 或 PowerShell，macOS / Linux 用默认 shell），并检查以下命令：

| 命令 | 用途 | 缺失时 |
| --- | --- | --- |
| `ssh`、`scp`、`ssh-keygen` | 连接服务器 | Windows 10+ 自带 OpenSSH；macOS / Linux 自带 |
| `curl` | 调用接口、验证 | 系统自带或 Git for Windows 自带 |
| `python3`（Windows 可能叫 `python`） | 运行小脚本 | Windows：`winget install -e --id Python.Python.3.12`；macOS：`brew install python` |

缺什么就先装什么（安装前告诉用户）。下文命令统一写 `python3`；Windows 上如果只有 `python`，自行替换。

**P0.2 创建目录和文件**

```bash
mkdir -p ~/.lsg/templates ~/.lsg/backup && chmod 700 ~/.lsg ~/.lsg/templates ~/.lsg/backup
cat > ~/.lsg/env.sh <<'EOF'
# Load lazy-pack variables; strip Windows CRLF (Notepad edits add \r) without touching the files.
set -a
for f in "$HOME/.lsg/vars.env" "$HOME/.lsg/secrets.env"; do
  [ -f "$f" ] && eval "$(tr -d '\r' < "$f")"
done
set +a
EOF
chmod 600 ~/.lsg/env.sh
```

**P0.3 生成随机值**（只补缺，已有的值不覆盖）

```bash
python3 - <<'PY'
import pathlib, secrets, string

home = pathlib.Path.home() / ".lsg"

def fill(path, defaults):
    """Append missing KEY=VALUE lines; never overwrite existing non-empty values."""
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    have = {}
    for line in text.splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            have[k.strip()] = v.strip()
    lines = [l for l in text.splitlines() if not (("=" in l) and l.split("=", 1)[0].strip() in defaults and not l.split("=", 1)[1].strip())]
    for k, v in defaults.items():
        if not have.get(k):
            lines.append(f"{k}={v}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(0o600)

alnum = string.ascii_lowercase + string.digits
rand = lambda n: "".join(secrets.choice(alnum) for _ in range(n))

fill(home / "vars.env", {
    "REGION": "", "AZ": "", "NODE": "", "INSTANCE": "lsg-node", "DOMAIN": "",
    "PANEL_SUB": "panel-" + rand(6), "PANEL_PATH": rand(18), "SUB_ID": rand(16),
    "XHTTP_PATH": rand(12), "PUB4": "", "PUB6": "", "BIND4": "", "NIC": "",
    "LOCAL_PROXY_PORT": "10808", "MODEL_OPUS": "", "MODEL_SONNET": "", "MODEL_HAIKU": "",
})
fill(home / "secrets.env", {
    "XUI_USER": "adm" + rand(7), "XUI_PASS": secrets.token_urlsafe(18),
    "CPA_CLIENT_KEY": "sk-cpa-" + secrets.token_urlsafe(32),
    "CPA_MGMT_KEY": secrets.token_urlsafe(32),
    "SPACESHIP_API_KEY": "", "SPACESHIP_API_SECRET": "",
})
print("ok")
PY
```

**P0.4 把附录模板保存到 `~/.lsg/templates/`**

文件名见附录各小节标题。

**P0.5 问用户四个问题**（一次问完）

1. **你的银行卡是哪个国家或地区发行的？** 服务器区域必须和发卡地区一致（防风控黄金法则：代理出口 IP 地区 = 发卡地区 = 账单地址地区）。
   - 先核对该地区在 Claude 支持列表里：<https://www.anthropic.com/supported-countries>
   - 中国大陆、中国香港不在支持列表里，Lightsail 也没有香港区域。遇到这种情况如实告诉用户：需要换一张受支持地区的卡，本流程无法绕过。
2. **Lightsail 用哪种方式创建？**
   - **A（推荐，更省事）**：你在 AWS 网页创建一个仅限 Lightsail 权限的 IAM 访问密钥，然后由 AI 用命令行创建实例、静态 IP 和全部防火墙规则。
   - **B**：你在 AWS 网页控制台自己点击创建，AI 接手后续配置。
3. **你已经有 Spaceship 域名了吗？** 有的话告诉我域名。
4. **需要 IPv6 节点吗？** 默认不需要。只有你家宽带有 IPv6 时才有用。

按回答把 `REGION`、`AZ`、`NODE`（以及已有的 `DOMAIN`）写入 `vars.env`。区域参考：

| 发卡地区 | REGION | NODE |
| --- | --- | --- |
| 新加坡 | `ap-southeast-1` | `sg` |
| 日本 | `ap-northeast-1` | `jp` |
| 韩国 | `ap-northeast-2` | `kr` |
| 美国 | `us-west-2`（俄勒冈，到东亚延迟较低）或 `us-east-1` | `us` |
| 英国 | `eu-west-2` | `uk` |
| 德国 | `eu-central-1` | `de` |
| 法国 | `eu-west-3` | `fr` |
| 加拿大 | `ca-central-1` | `ca` |
| 澳大利亚 | `ap-southeast-2` | `au` |
| 印度 | `ap-south-1` | `in` |

`AZ` 默认取 `${REGION}a`。走 A 路线时，P2 会用 `aws lightsail get-regions --include-availability-zones` 再核对一次。

---

## P1 [用户] 注册 AWS 账号并做两项防护

AI 输出检查点，内容如下：

1. 打开 <https://aws.amazon.com> 注册国际版账号（不要选中国区）。
   - 准备邮箱、外币 Visa / Mastercard（会有 `$1–2` 预授权并退回）、手机号（`+86` 可用）。
   - 支持计划选 **Basic support - Free**。
2. 账号激活后，立刻开启 MFA 两步验证：右上角账号名 → **Security credentials** → **Assign MFA device** → 用手机验证器 App 扫码。
3. 设置月度预算告警：进入 **Billing and Cost Management** → **Budgets** → **Create budget** → **Monthly cost budget**，金额填 `15`（美元），填上提醒邮箱。

完成标志：能用 MFA 登录 AWS 控制台，预算列表里有一条 `$15` 的月度预算。

---

## P2 Lightsail 实例、静态 IP、防火墙

### P2-A 路线 A：AI 用 AWS CLI 创建（推荐）

**P2-A.1 [AI] 安装 AWS CLI v2**

- Windows：`winget install -e --id Amazon.AWSCLI`
- macOS：`brew install awscli`
- Linux：按 <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html> 安装。

装完执行 `aws --version` 验证。Windows 可能需要新开终端才能找到 `aws`。

**P2-A.2 [用户] 创建仅限 Lightsail 的 IAM 访问密钥**

检查点内容：

1. 控制台顶部搜索 **IAM** → **Users** → **Create user**，用户名 `lsg-cli`，**不要**勾选控制台访问，下一步时不添加权限，直接创建。
2. 点进 `lsg-cli` → **Permissions** → **Add permissions** → **Create inline policy** → 切到 **JSON**，粘贴下面内容，策略名 `LightsailOnly`，创建：

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow", "Action": "lightsail:*", "Resource": "*" }]
   }
   ```

3. **Security credentials** → **Create access key** → 用途选 **Command Line Interface (CLI)** → 勾选确认 → 创建。密钥只显示一次，先别关页面。
4. **在你自己新开的终端里**（不是在和 AI 的对话里）运行 `aws configure`，依次填入：
   - Access Key ID
   - Secret Access Key
   - Default region：AI 告诉你的 `REGION` 值
   - Output format：`json`

   这样密钥不会经过 AI 对话。
5. 回复「完成」。

**P2-A.3 [AI] 校验身份**

```bash
aws sts get-caller-identity --query Arn --output text
```

结果必须形如 `arn:aws:iam::<账号>:user/lsg-cli`。如果出现 `:root`，立即停止，让用户删除根用户访问密钥，改用 IAM 用户。

**P2-A.4 [AI] 生成 SSH 密钥并导入 Lightsail**

私钥只留在本机：

```bash
. ~/.lsg/env.sh
[ -f ~/.ssh/lsg_lightsail ] || ssh-keygen -t rsa -b 4096 -N "" -f ~/.ssh/lsg_lightsail -C lsg-lightsail
aws lightsail get-key-pair --region "$REGION" --key-pair-name lsg-key >/dev/null 2>&1 || \
  aws lightsail import-key-pair --region "$REGION" --key-pair-name lsg-key \
    --public-key-base64 "$(cat ~/.ssh/lsg_lightsail.pub)"
```

**P2-A.5 [AI] 选套餐和镜像**

```bash
. ~/.lsg/env.sh
aws lightsail get-regions --include-availability-zones --region "$REGION" \
  --query "regions[?name=='$REGION'].availabilityZones[].zoneName" --output text
aws lightsail get-bundles --region "$REGION" \
  --query "bundles[?supportedPlatforms[0]=='LINUX_UNIX' && ramSizeInGb==\`2\` && !contains(bundleId,'ipv6')].[bundleId,price,cpuCount,diskSizeInGb,transferPerMonthInGb]" --output table
aws lightsail get-blueprints --region "$REGION" --query "blueprints[?contains(blueprintId,'debian')].blueprintId" --output text
```

选 2 GB 内存、约 `$12/月` 的双栈套餐（不要带 `ipv6` 的仅 IPv6 套餐），以及 `debian_12`。把套餐 ID、价格、区域告诉用户，**等用户确认后**再创建。

**P2-A.6 [AI] 创建实例、绑定静态 IP、配置双栈防火墙**

```bash
. ~/.lsg/env.sh
BUNDLE=small_3_0   # replace with the bundle ID the user confirmed
aws lightsail create-instances --region "$REGION" --instance-names "$INSTANCE" \
  --availability-zone "$AZ" --blueprint-id debian_12 --bundle-id "$BUNDLE" \
  --ip-address-type dualstack --key-pair-name lsg-key
# Poll until running (no CLI waiter exists for Lightsail)
for i in $(seq 1 40); do
  s=$(aws lightsail get-instance-state --region "$REGION" --instance-name "$INSTANCE" --query state.name --output text)
  echo "$s"; [ "$s" = running ] && break; sleep 10
done
aws lightsail allocate-static-ip --region "$REGION" --static-ip-name "${INSTANCE}-ip"
aws lightsail attach-static-ip --region "$REGION" --static-ip-name "${INSTANCE}-ip" --instance-name "$INSTANCE"
```

防火墙规则（这一步会覆盖实例现有规则；新实例覆盖无妨）。`ipv6Cidrs` 让 IPv6 防火墙同时生效：

```bash
. ~/.lsg/env.sh
aws lightsail put-instance-public-ports --region "$REGION" --instance-name "$INSTANCE" --port-infos '[
 {"fromPort":22,"toPort":22,"protocol":"tcp","cidrs":["0.0.0.0/0"],"ipv6Cidrs":["::/0"]},
 {"fromPort":80,"toPort":80,"protocol":"tcp","cidrs":["0.0.0.0/0"],"ipv6Cidrs":["::/0"]},
 {"fromPort":443,"toPort":443,"protocol":"tcp","cidrs":["0.0.0.0/0"],"ipv6Cidrs":["::/0"]},
 {"fromPort":443,"toPort":443,"protocol":"udp","cidrs":["0.0.0.0/0"],"ipv6Cidrs":["::/0"]},
 {"fromPort":20000,"toPort":50000,"protocol":"udp","cidrs":["0.0.0.0/0"],"ipv6Cidrs":["::/0"]}
]'
aws lightsail get-instance-port-states --region "$REGION" --instance-name "$INSTANCE" --output table
```

**P2-A.7 [AI] 读出 IP 并写入 vars.env**

```bash
. ~/.lsg/env.sh
aws lightsail get-static-ip --region "$REGION" --static-ip-name "${INSTANCE}-ip" --query staticIp.ipAddress --output text   # -> PUB4
aws lightsail get-instance --region "$REGION" --instance-name "$INSTANCE" --query 'instance.ipv6Addresses[0]' --output text # -> PUB6
```

把两个值写入 `vars.env` 的 `PUB4` 和 `PUB6`。私钥路径为 `~/.ssh/lsg_lightsail`。

提醒用户：静态 IP 绑定在运行中的实例上是免费的；如果以后删除实例，要同时释放静态 IP，否则会单独计费。

### P2-B 路线 B：用户在控制台创建

**P2-B.1 [用户] 按第一篇教程第二步操作**

检查点内容：

1. Lightsail → **Create instance**：区域选 AI 给出的区域；**Linux/Unix** → **OS Only** → **Debian 12**。
2. 下载默认 SSH 密钥（`.pem`）。
3. 套餐选 `$12/月`（2 GB），勾选 **Dual-stack**，创建。
4. 实例页 → **Networking** → **Create static IP** 并绑定到该实例。
5. **IPv4 Firewall** 与 **IPv6 Firewall** 两个标签页都添加这些规则：
   - TCP `22`、`80`、`443`
   - UDP `443`
   - UDP `20000-50000`
6. 告诉 AI：`.pem` 文件保存在哪、静态 IPv4 是多少、实例页上的 IPv6 是多少。

**P2-B.2 [AI] 保存密钥和 IP**

- 把 `.pem` 移到 `~/.ssh/lsg_lightsail`。
- 修正权限：
  - macOS / Linux：`chmod 600 ~/.ssh/lsg_lightsail`
  - Windows（PowerShell）：

    ```powershell
    icacls "$env:USERPROFILE\.ssh\lsg_lightsail" /inheritance:r /grant:r "${env:USERNAME}:R"
    ```

- 把 IP 写入 `PUB4` 和 `PUB6`。

---

## P3 [AI] SSH 快捷登录与服务器初始化

**P3.1 写 SSH 配置**

追加到 `~/.ssh/config`（已有 `Host lightsail` 时先备份再更新）：

```text
Host lightsail
    HostName <PUB4>
    User admin
    IdentityFile ~/.ssh/lsg_lightsail
    IdentitiesOnly yes
    ServerAliveInterval 60
```

验证：

```bash
ssh -o StrictHostKeyChecking=accept-new lightsail 'echo ok && cat /etc/debian_version'
```

新实例开机后 1–2 分钟才能连上，失败就等 20 秒重试。

**P3.2 初始化**

安装基础软件和 Docker、开启 BBR、创建 4 GB Swap：

```bash
ssh lightsail 'sudo bash -s' <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confold upgrade
apt-get install -y -q nginx libnginx-mod-stream python3-venv curl sqlite3 iptables ca-certificates
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
printf 'net.core.default_qdisc=fq\nnet.ipv4.tcp_congestion_control=bbr\n' > /etc/sysctl.d/99-bbr.conf
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
sysctl --system >/dev/null
echo "bbr=$(sysctl -n net.ipv4.tcp_congestion_control)"
free -h | grep -i swap
docker --version && docker compose version
EOF
```

**P3.3 读取网卡信息**

```bash
ssh lightsail 'bash -s' <<'EOF'
NIC=$(ip -4 route show default | awk '{print $5; exit}')
echo "NIC=$NIC"
echo "BIND4=$(ip -4 -o addr show dev "$NIC" | awk '{print $4}' | cut -d/ -f1 | head -1)"
echo "PUB6=$(ip -6 -o addr show dev "$NIC" scope global | awk '{print $4}' | cut -d/ -f1 | head -1)"
EOF
```

写入 `NIC`、`BIND4`（应为 `172.26.x.x` 这类内网地址），并核对 `PUB6` 与 P2 读到的一致。

记住：AWS 网卡上绑的是内网 IPv4。Hysteria2 监听和 iptables DNAT 用 `BIND4`，DNS 解析用 `PUB4`。

---

## P4 [用户] 购买域名并创建 Spaceship API 密钥

已有域名时跳过购买，只做第 3–5 条。检查点内容：

1. 打开 <https://www.spaceship.com> 注册并登录（支持支付宝和信用卡）。
2. 搜索并购买一个域名。`.online`、`.xyz` 首年便宜，注意看续费价格。
3. 后台 **API Manager** → **New API key**，权限**只勾** `dnsrecords:read` 和 `dnsrecords:write`。
4. AI 会帮你打开 `~/.lsg/secrets.env`：
   - Windows：`notepad "$USERPROFILE\.lsg\secrets.env"`
   - macOS：`open -e ~/.lsg/secrets.env`

   把 API key 填到 `SPACESHIP_API_KEY=` 后面，API secret 填到 `SPACESHIP_API_SECRET=` 后面，保存。secret 只显示一次。
5. 回复「完成」，并告诉 AI 你的域名（域名不是机密）。

AI 把域名写入 `vars.env` 的 `DOMAIN`，然后检查两个密钥是否非空（只检查非空，不打印）：

```bash
. ~/.lsg/env.sh
[ -n "$SPACESHIP_API_KEY" ] && [ -n "$SPACESHIP_API_SECRET" ] && echo ok
```

---

## P5 [AI] 通过 Spaceship API 添加 DNS 记录

记录规划：全部直连服务器，不开 CDN，TTL `300`。

| 子域名 | 类型 | 指向 | 用途 |
| --- | --- | --- | --- |
| `${NODE}-v4` | 仅 A | `PUB4` | V4 节点（不要加 AAAA） |
| `${NODE}-v6` | 仅 AAAA | `PUB6` | V6 节点（不要加 A） |
| `${NODE}-x` | A + AAAA | `PUB4` + `PUB6` | XHTTP Reality 共用 SNI |
| `sub` | A | `PUB4` | 订阅网站 |
| `${PANEL_SUB}` | A | `PUB4` | 3x-ui 面板 |
| `api` | A | `PUB4` | CPA 网关 |

```bash
. ~/.lsg/env.sh
python3 - <<'PY'
import json, os, urllib.request, urllib.error
e = os.environ
n, d = e["NODE"], e["DOMAIN"]
items = [
    {"type": "A",    "name": f"{n}-v4",       "address": e["PUB4"], "ttl": 300},
    {"type": "AAAA", "name": f"{n}-v6",       "address": e["PUB6"], "ttl": 300},
    {"type": "A",    "name": f"{n}-x",        "address": e["PUB4"], "ttl": 300},
    {"type": "AAAA", "name": f"{n}-x",        "address": e["PUB6"], "ttl": 300},
    {"type": "A",    "name": "sub",           "address": e["PUB4"], "ttl": 300},
    {"type": "A",    "name": e["PANEL_SUB"],  "address": e["PUB4"], "ttl": 300},
    {"type": "A",    "name": "api",           "address": e["PUB4"], "ttl": 300},
]
req = urllib.request.Request(
    f"https://spaceship.dev/api/v1/dns/records/{d}",
    data=json.dumps({"force": True, "items": items}).encode(), method="PUT",
    headers={"X-Api-Key": e["SPACESHIP_API_KEY"], "X-Api-Secret": e["SPACESHIP_API_SECRET"],
             "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print("PUT", r.status)
except urllib.error.HTTPError as err:
    print("HTTP", err.code, err.read().decode()[:600])
PY
```

- 如果返回字段错误（例如 422 提示 `address`），按报错调整字段名，例如改成 `value`，再重试。
- 本机连不上 `spaceship.dev` 时，把同样的脚本放到服务器上执行（密钥通过 stdin 传入，执行完删除）。

**验证解析**：在服务器上查，避免本机 DNS 污染和不同系统的输出差异。最多轮询 10 分钟：

```bash
. ~/.lsg/env.sh
ssh lightsail 'bash -s' "$DOMAIN" "$NODE" "$PANEL_SUB" <<'EOF'
d=$1
for h in "$2-v4" "$2-x" sub "$3" api; do
  printf '%s -> ' "$h.$d"; getent ahosts "$h.$d" | awk '{print $1}' | sort -u | tr '\n' ' '; echo
done
EOF
```

每个都解析到 `PUB4`（`${NODE}-x` 同时有 IPv6）才算通过。

API 始终失败时，退回人工：给用户上面的表格，让用户在 Spaceship → **Domain List** → 域名 → **DNS** 中手动添加。

---

## P6 [AI] 签发通配符证书并配置自动续期

```bash
. ~/.lsg/env.sh
# Credentials go to the server through stdin; nothing is echoed.
printf '[spaceship]\napi_key = %s\napi_secret = %s\n' "$SPACESHIP_API_KEY" "$SPACESHIP_API_SECRET" | \
  ssh lightsail 'sudo install -d -m 700 /etc/letsencrypt && sudo tee /etc/letsencrypt/spaceship.ini >/dev/null && sudo chmod 600 /etc/letsencrypt/spaceship.ini'

ssh lightsail "sudo bash -s" <<EOF
set -euo pipefail
[ -x /opt/certbot/bin/certbot ] || { python3 -m venv /opt/certbot && /opt/certbot/bin/pip install -q certbot certbot-dns-spaceship; }
/opt/certbot/bin/certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
  --authenticator dns-spaceship --dns-spaceship-credentials /etc/letsencrypt/spaceship.ini \
  --dns-spaceship-propagation-seconds 120 --key-type ecdsa \
  --cert-name $DOMAIN -d '*.$DOMAIN' -d '$DOMAIN'
ls -l /etc/letsencrypt/live/$DOMAIN/
EOF
```

然后用附录「certbot 续期命令」安装 `certbot.service`、`certbot.timer` 和续期钩子（续期后重载 Nginx 并重启 x-ui），执行：

```bash
systemctl daemon-reload && systemctl enable --now certbot.timer
```

验证：`systemctl is-active certbot.timer` 输出 `active`，`/etc/letsencrypt/live/$DOMAIN/fullchain.pem` 存在。

刚签完的 1 小时内不要跑 `certbot renew --dry-run`：旧 TXT 记录还在缓存里，会误报失败。

---

## P7 [AI] 伪装页与 Nginx 443 SNI 分流

**P7.1 渲染模板并上传**

```bash
. ~/.lsg/env.sh
render() { sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__NODE__/$NODE/g" -e "s/__PANEL_SUB__/$PANEL_SUB/g" "$HOME/.lsg/templates/$1"; }
ssh lightsail 'sudo mkdir -p /var/www/site /etc/nginx/stream.d /etc/nginx/snippets && sudo rm -f /etc/nginx/sites-enabled/default'
render site-index.html     | ssh lightsail 'sudo tee /var/www/site/index.html >/dev/null'
render ssl-cert.conf       | ssh lightsail 'sudo tee /etc/nginx/snippets/ssl-cert.conf >/dev/null'
render proxy-stream.conf   | ssh lightsail 'sudo tee /etc/nginx/stream.d/proxy-stream.conf >/dev/null && sudo chmod 600 /etc/nginx/stream.d/proxy-stream.conf'
render proxy.conf          | ssh lightsail 'sudo tee /etc/nginx/sites-available/proxy.conf >/dev/null'
```

**P7.2 调整 nginx.conf 并启用站点**

```bash
ssh lightsail 'sudo bash -s' <<'EOF'
set -e
c=/etc/nginx/nginx.conf
cp -n "$c" "$c.bak.orig"
grep -q worker_rlimit_nofile "$c" || sed -i '/^pid /a worker_rlimit_nofile 65535;' "$c"
sed -i 's/worker_connections [0-9]*;/worker_connections 4096;/' "$c"
grep -q 'stream.d/\*.conf' "$c" || echo 'include /etc/nginx/stream.d/*.conf;' >> "$c"   # main context, outside http{}
ln -sf /etc/nginx/sites-available/proxy.conf /etc/nginx/sites-enabled/proxy.conf
nginx -t && systemctl enable --now nginx && systemctl reload nginx
EOF
```

**P7.3 验证伪装页**

```bash
. ~/.lsg/env.sh
curl -s "https://sub.$DOMAIN/" | grep -o 'Notes &amp; Bookmarks'
```

能匹配到就通过。节点域名要等 P8 起好 Xray 后才能访问。

---

## P8 [AI] 3x-ui、加密订阅、三协议入站、Hysteria2 端口跳跃

### P8.1 非交互安装 3x-ui，并锁定只监听本机

```bash
. ~/.lsg/env.sh
ssh lightsail "curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh -o /tmp/xui-install.sh"
# Credentials go in via stdin to a root-only temp file; the installer output (which echoes them) stays in a root-only log.
printf 'XUI_USERNAME=%q\nXUI_PASSWORD=%q\nXUI_WEB_BASE_PATH=%q\n' "$XUI_USER" "$XUI_PASS" "$PANEL_PATH" | \
  ssh lightsail 'sudo install -m 600 /dev/stdin /root/xui.env'
ssh lightsail 'sudo bash -s' <<'EOF'
set -a; . /root/xui.env; set +a
XUI_NONINTERACTIVE=1 XUI_PANEL_PORT=54321 XUI_SSL_MODE=none bash /tmp/xui-install.sh </dev/null >/root/xui-install.log 2>&1
echo "install_exit=$?"
chmod 600 /root/xui-install.log; rm -f /root/xui.env
EOF
ssh lightsail 'sudo /usr/local/x-ui/x-ui setting -listenIP 127.0.0.1 && sudo systemctl restart x-ui && sleep 2 && sudo ss -ltnp | grep 54321'
```

- 安装日志含面板账号密码，只保存在服务器的 `/root/xui-install.log`（root 可读），不要整份打印。
- 面板必须只监听 `127.0.0.1:54321`。
- 当前版本的参数是 `-listenIP`。旧教程里的 `-listen` 已不可用。
- 版本不一致时，用 `x-ui setting -h` 查看实际参数。

### P8.2 准备 API Token 和小工具

把附录 `xui_api.py` 上传到服务器，再生成 `/root/lsg/xui.json`（面板地址和 API Token，root 只读）：

```bash
. ~/.lsg/env.sh
ssh lightsail "sudo bash -s" <<EOF
set -e
install -d -m 700 /root/lsg
TOKEN=\$(sed -n 's/^XUI_API_TOKEN=//p' /etc/x-ui/install-result.env 2>/dev/null | tr -d "'\"")
[ -n "\$TOKEN" ] || TOKEN=\$(/usr/local/x-ui/x-ui setting -getApiToken 2>/dev/null | grep -Eo '[A-Za-z0-9._-]{24,}' | tail -1)
python3 -c "import json,sys; json.dump({'base':'http://127.0.0.1:54321/$PANEL_PATH','token':sys.argv[1]}, open('/root/lsg/xui.json','w'))" "\$TOKEN"
chmod 600 /root/lsg/xui.json
EOF
ssh lightsail 'sudo tee /root/lsg/xui_api.py >/dev/null && sudo chmod 700 /root/lsg/xui_api.py' < ~/.lsg/templates/xui_api.py
ssh lightsail 'sudo python3 /root/lsg/xui_api.py GET /panel/api/server/getXrayVersion'
```

返回 `success: true` 即通过。然后保存接口文档，供你核对字段：

```bash
ssh lightsail 'sudo bash -c "python3 /root/lsg/xui_api.py GET /panel/api/openapi.json > /root/lsg/openapi.json"'
```

后续调用都用 `sudo python3 /root/lsg/xui_api.py <GET|POST> <路径> [-]`，`-` 表示请求体从 stdin 读入。

### P8.3 订阅设置

1. `POST /panel/api/setting/all` 取得完整设置对象。
2. 只修改下表字段，其余字段原样保留，整个对象发给 `POST /panel/api/setting/update`。
3. 再调用 `POST /panel/api/setting/restartPanel`。

| 字段 | 目标值 |
| --- | --- |
| `webListen` | `127.0.0.1` |
| `webCertFile` / `webKeyFile` | 空字符串（TLS 由 Nginx 负责） |
| `subEnable` | `true` |
| `subListen` | `127.0.0.1` |
| `subPort` | `2096` |
| `subPath` | `/sub/` |
| `subURI` | `https://sub.<DOMAIN>/sub/` |
| `subEncrypt` | `true` |
| `subUpdates` | `12` |
| 订阅证书字段（如 `subCertFile` / `subKeyFile`） | 空字符串 |
| “显示信息”类字段（如 `subShowInfo`） | `true`（字段存在时才改） |

### P8.4 Xray 路由防封检查

`POST /panel/api/xray/` 取得 Xray 模板，确认路由里有两条规则：
- `geoip:private` 走 `blocked`
- `protocol: bittorrent` 走 `blocked`

默认模板通常已包含。缺少时补上，再用 `POST /panel/api/xray/update` 保存。这两条用来避免 BT 版权投诉导致 AWS 封停实例。

### P8.5 生成密钥，添加入站

**生成参数**

- 每个 Reality 入站各生成一对 X25519：`GET /panel/api/server/getNewX25519Cert`，返回 `obj.privateKey` 和 `obj.publicKey`。
- UUID：`GET /panel/api/server/getNewUUID`，或在本地用 Python 生成。
- `shortIds`：8–16 位随机十六进制。
- 所有客户端的 `subId` 都填 `SUB_ID`。`email` 每个入站唯一，例如 `u1-vision`、`u1-xhttp`、`u1-hy2`。

**请求格式**

- 新版本接受 JSON 对象，`settings`、`streamSettings`、`sniffing` 直接写成嵌套对象。如果服务器返回解析错误，改为把这三个字段序列化成 JSON 字符串（旧版本格式）。
- 结构参考：`openapi.json` 中 `/panel/api/inbounds/add` 的示例，以及 3x-ui 仓库 `frontend/src/test/golden/fixtures/inbound-full/` 下的 `vless-tcp-reality.json`、`hysteria-tls.json`。

**入站 1：`<NODE大写>-v4-Reality-Vision`**（主力）

```json
{
  "remark": "<NODE大写>-v4-Reality-Vision", "enable": true, "listen": "127.0.0.1", "port": 10000, "protocol": "vless",
  "expiryTime": 0, "total": 0,
  "settings": { "clients": [ { "id": "<UUID>", "email": "u1-vision", "flow": "xtls-rprx-vision",
                               "limitIp": 0, "totalGB": 0, "expiryTime": 0, "enable": true, "subId": "<SUB_ID>", "reset": 0 } ],
                "decryption": "none", "encryption": "none", "fallbacks": [] },
  "streamSettings": { "network": "tcp", "tcpSettings": { "header": { "type": "none" } }, "security": "reality",
    "realitySettings": { "show": false, "xver": 0, "target": "127.0.0.1:8443",
      "serverNames": ["<NODE>-v4.<DOMAIN>"], "privateKey": "<PRIV>", "shortIds": ["<SHORTID>"],
      "minClientVer": "", "maxClientVer": "", "maxTimediff": 0,
      "settings": { "publicKey": "<PUB>", "fingerprint": "chrome", "serverName": "", "spiderX": "/" } } },
  "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"], "metadataOnly": false, "routeOnly": true }
}
```

`flow` 必须是 `xtls-rprx-vision`，留空会暴露 TLS 嵌套特征。

**入站 2：`<NODE大写>-v4-XHTTP-Reality`**（抗干扰）

与入站 1 相同，只改这些：

| 字段 | 值 |
| --- | --- |
| `port` | `10009` |
| `email` | `u1-xhttp` |
| `flow` | 空字符串 |
| `streamSettings.network` | `"xhttp"` |
| `tcpSettings` | 换成 `"xhttpSettings": {"path": "/<XHTTP_PATH>", "host": "", "mode": "auto"}`（mode 不要用 `packet-up`） |
| `serverNames` | `["<NODE>-x.<DOMAIN>"]` |
| 密钥对 | 新生成一对 |

**订阅里的外部地址**

两个 Reality 入站在订阅里都必须显示为 `<NODE>-v4.<DOMAIN>:443`，否则订阅会变成 `127.0.0.1`。设置方式取决于版本：

- `openapi.json` 里有 `/panel/api/hosts/add`：每个入站各建一个 host 组：

  ```json
  {"inboundIds": [<入站ID>], "remark": "<入站名>-ext", "hosts": ["<NODE>-v4.<DOMAIN>"], "port": 443, "security": "same"}
  ```

- 否则在入站的 `streamSettings` 里加：

  ```json
  "externalProxy": [{"forceTls": "same", "dest": "<NODE>-v4.<DOMAIN>", "port": 443, "remark": ""}]
  ```

XHTTP 入站的地址用 `<NODE>-v4`（决定走哪条线路），SNI 保持 `<NODE>-x`（决定 Nginx 分流到哪个后端）。

**入站 3：`<NODE大写>-v4-Hysteria2`**（晚高峰高速 UDP）

| 项目 | 值 |
| --- | --- |
| 协议 | `hysteria`，`settings.version` 为 `2` |
| 客户端 | `auth` 为随机字符串，`email` 为 `u1-hy2`，`subId` 为 `SUB_ID` |
| 监听 | `BIND4`，端口 `443`。不要填 `127.0.0.1` 或 `0.0.0.0` |
| `security` | `tls` |
| `serverName` | `<NODE>-v4.<DOMAIN>` |
| `alpn` | `["h3"]` |
| 证书 | `certificateFile` = `/etc/letsencrypt/live/<DOMAIN>/fullchain.pem`，`keyFile` = `/etc/letsencrypt/live/<DOMAIN>/privkey.pem` |
| 伪装（Masquerade） | `file` 类型，目录 `/var/www/site`；不开 Salamander 混淆 |
| 外部地址 | `<NODE>-v4.<DOMAIN>:443` |

伪装字段的位置按 `openapi.json` 或仓库 `frontend/src/schemas/protocols/stream/hysteria.ts` 确定。拿不准时，前两个入站照常由你通过 API 添加，第三个改为引导用户在面板里手动添加：

- 面板地址：`https://<PANEL_SUB>.<DOMAIN>/<PANEL_PATH>/`
- 账号密码：在 `secrets.env` 的 `XUI_USER` 和 `XUI_PASS` 两行，让用户自己打开文件看。
- 按上表逐项填写。

**IPv6 节点**（仅当用户在 P0 选择需要）：按同样规格再建三个入站，监听分别为 `127.0.0.1:10010`、`127.0.0.1:10019` 和 `<PUB6>:443`，外部地址统一为 `<NODE>-v6.<DOMAIN>:443`。

全部添加后调用 `POST /panel/api/server/restartXrayService`。

### P8.6 Hysteria2 端口跳跃

按附录 `hy2-porthop.sh` 与 `hy2-porthop.service` 渲染（替换 `__NIC__`、`__BIND4__`、`__PUB6__`），上传为：
- `/usr/local/sbin/hy2-porthop.sh`（权限 `755`）
- `/etc/systemd/system/hy2-porthop.service`

然后执行：

```bash
systemctl daemon-reload && systemctl enable --now hy2-porthop
iptables -t nat -S PREROUTING | grep 20000
```

### P8.7 验证

```bash
. ~/.lsg/env.sh
ssh lightsail "sudo ss -ltnup | grep -E ':(10000|10009|2096|54321)\b|$BIND4:443'"
curl -s "https://$NODE-v4.$DOMAIN/" | grep -o 'Notes &amp; Bookmarks'
# Subscription must contain the external host:port; print host:port pairs only, never the full links.
curl -fsS "https://sub.$DOMAIN/sub/$SUB_ID" | python3 -c "import sys,base64,re; t=sys.stdin.read().strip(); s=base64.b64decode(t+'='*(-len(t)%4)).decode('utf-8','ignore'); print(sorted(set(re.findall(r'@([^:/?#\s]+:\d+)', s))))"
```

通过标准：
- 节点域名直连返回伪装页（说明 Reality 自偷回落正常）。
- 订阅解码后只出现 `<NODE>-v4.<DOMAIN>:443`，不出现 `127.0.0.1`。

---

## P9 [AI+用户] Windows 安装 v2rayN 并导入订阅

**P9.1 [AI] 下载并解压**

1. 读取最新版本：

   ```bash
   curl -s https://api.github.com/repos/2dust/v2rayN/releases/latest
   ```

2. 选 `v2rayN-windows-64.zip`（ARM 电脑选 `arm64`）。要求 `v7.24` 以上，才完整支持 XHTTP。
3. 本机下载失败时，在服务器上下载后 `scp` 回本地。
4. 解压到非 C 盘目录：D 盘存在时用 `D:\Programs\v2rayN`，否则问用户放哪。

   ```powershell
   Expand-Archive -Force <zip> <目录>
   ```

5. 启动 `v2rayN.exe`。

macOS / Linux 用户改下载对应平台的包。

**P9.2 [AI] 把订阅地址放进剪贴板**

不在对话里显示订阅地址：

```bash
. ~/.lsg/env.sh
printf '%s' "https://sub.$DOMAIN/sub/$SUB_ID" | clip.exe   # macOS: pbcopy ; Linux: xclip -selection clipboard
```

**P9.3 [用户] 在 v2rayN 里操作**

1. 顶部 **订阅分组** → **订阅分组设置** → **添加**：备注随意，**地址（Url）** 处按 `Ctrl+V` 粘贴，确定。
2. **订阅分组** → **更新全部订阅（不通过代理）**。
3. 双击 `…-Hysteria2` 节点，在 **端口跳跃 / Ports** 填 `20000-50000`，保存。订阅不会自动带上这个范围。
4. 全选节点按 `Ctrl+R` 测真连接延迟，把延迟最低的 **v4** 节点设为活动服务器。家里没有 IPv6 时，v6 节点超时是正常的。
5. 底部状态栏设为 **系统代理：自动配置系统代理**、**路由：绕过大陆**。
6. 告诉 AI 左下角显示的本地端口（默认 `10808`）。

**P9.4 [AI] 验证代理出口**

```bash
. ~/.lsg/env.sh
curl -s --max-time 20 -x "socks5h://127.0.0.1:$LOCAL_PROXY_PORT" https://ipinfo.io/json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip'), d.get('country'))"
```

出口 IP 等于 `PUB4`，国家等于发卡地区，才算通过。

**可选 TUN 模式**：想让命令行也走代理时，引导用户用 Windows「任务计划程序」设置“登录时以最高权限运行 `v2rayN.exe`”，再打开 v2rayN 底部的 **Tun 模式**。

---

## P10 [AI] 部署开源项目 CPA（CLIProxyAPI）

```bash
. ~/.lsg/env.sh
ssh lightsail 'sudo mkdir -p /opt/cliproxyapi/auths /opt/cliproxyapi/logs /opt/cliproxyapi/plugins'
sed -e "s|__CPA_CLIENT_KEY__|$CPA_CLIENT_KEY|" -e "s|__CPA_MGMT_KEY__|$CPA_MGMT_KEY|" ~/.lsg/templates/cpa-config.yaml | \
  ssh lightsail 'sudo tee /opt/cliproxyapi/config.yaml >/dev/null && sudo chmod 600 /opt/cliproxyapi/config.yaml'
cat ~/.lsg/templates/cpa-docker-compose.yml | ssh lightsail 'sudo tee /opt/cliproxyapi/docker-compose.yml >/dev/null'
sed -e "s/__DOMAIN__/$DOMAIN/g" ~/.lsg/templates/cliproxyapi.conf | ssh lightsail 'sudo tee /etc/nginx/sites-available/cliproxyapi.conf >/dev/null'
ssh lightsail 'sudo bash -s' <<'EOF'
set -e
cd /opt/cliproxyapi && docker compose pull && docker compose up -d
ln -sf /etc/nginx/sites-available/cliproxyapi.conf /etc/nginx/sites-enabled/cliproxyapi.conf
nginx -t && systemctl reload nginx
sleep 5; docker logs --tail 30 cli-proxy-api
EOF
```

- 两个 CPA 密钥的分工：
  - `CPA_CLIENT_KEY`（`access.api-keys`）给客户端调用。
  - `CPA_MGMT_KEY`（`management.secret-key`）只用于登录管理页。启动后会自动变成 bcrypt 哈希；连续输错几次会触发 IP 临时封禁（403）。
- 日志报配置字段错误时，对照上游最新 `config.example.yaml`（<https://github.com/router-for-me/CLIProxyAPI>）调整模板，再重启容器。

**验证**：

```bash
. ~/.lsg/env.sh
curl -s -o /dev/null -w "management.html %{http_code}\n" "https://api.$DOMAIN/management.html"
printf 'Authorization: Bearer %s\n' "$CPA_CLIENT_KEY" | curl -s -o /dev/null -w "/v1/models %{http_code}\n" -H @- "https://api.$DOMAIN/v1/models"
```

两个都应返回 `200`。此时模型列表可能为空，P14 完成 OAuth 后才有模型。

---

## P11 [AI] 上篇基础设施自检

```bash
ssh lightsail 'sudo bash -s' <<'EOF'
systemctl is-active nginx x-ui certbot.timer hy2-porthop docker
docker ps --format '{{.Names}} {{.Status}}'
echo '--- public listeners (should be only 22/80/443 tcp, BIND4/PUB6:443 udp) ---'
ss -tulpn | awk 'NR>1 {print $1, $5}' | grep -vE '127\.0\.0\.1|\[::1\]' | sort -u
free -h | grep -i swap
EOF
```

确认后台服务都只监听 `127.0.0.1`。然后向用户报告：上篇部分已完成，接下来进入下篇（Claude Pro 注册与接入）。

---

## P12 [AI+用户] 安装 Mullvad 指纹浏览器并配置代理

**为什么要用它**：日常 Chrome / Edge 积累了大量 Cookie、插件、字体指纹，WebRTC 还可能泄露真实 IP，直接用来注册和付款容易触发 Anthropic 与 Stripe 风控。Mullvad Browser 默认抹除指纹、禁用 WebRTC。

**P12.1 [AI] 安装**

- Windows：
  1. 先执行 `winget search "Mullvad Browser"`，用查到的 ID 执行 `winget install -e --id <ID>`。
  2. 失败时从 <https://github.com/mullvad/mullvad-browser/releases> 下载 `mullvad-browser-windows-x86_64-<版本>.exe` 并运行，安装界面让用户点。
  3. 安装位置建议在非 C 盘。
- macOS：`brew install --cask mullvad-browser`

**P12.2 [用户] 启动一次再完全关闭**

让用户启动一次 Mullvad Browser，然后完全关闭，以便生成配置目录。

**P12.3 [AI] 写入代理配置**

1. 在以下位置查找 `prefs.js`，所在目录就是配置目录：
   - Windows：`%APPDATA%\Mullvad\MullvadBrowser\Profiles\`，以及安装目录下的 `Browser\MullvadBrowser\Data\Browser\profile.default\`
   - macOS：`~/Library/Application Support/MullvadBrowser/Profiles/`
2. 把附录 `mullvad-user.js` 里的 `__LOCAL_PROXY_PORT__` 替换为 `LOCAL_PROXY_PORT`，保存为该目录下的 `user.js`。已有 `user.js` 时先备份。

`user.js` 的效果：
- 走 v2rayN 的 SOCKS5 代理，并通过代理解析域名，防止 DNS 泄露。
- **不代理 `localhost, 127.0.0.1`**。这一条最关键：P14 的 OAuth 回调地址是 `http://localhost:54545`，被代理的话会发到海外服务器，导致授权超时失败。

找不到配置目录时，改为引导用户手动设置：Settings → 搜索 `Proxy` → **Settings…** → **Manual proxy configuration**：
- SOCKS Host `127.0.0.1`，Port `10808`，选 SOCKS v5
- 勾选 **Proxy DNS when using SOCKS v5**
- **No proxy for** 填 `localhost, 127.0.0.1`

**P12.4 [用户] 两项防泄露检查**

重新打开 Mullvad Browser，依次访问：

1. <https://ipinfo.io/json>：`ip` 应为你的服务器 IP（AI 会告诉你末两段），`country` 应为发卡国家代码。
2. <https://browserleaks.com/webrtc>：不应出现你的国内宽带 IP。

两项都正常后回复「完成」。

**重要须知**：Mullvad 默认永久隐私模式，**关闭窗口就会清空登录状态**。P13 注册付款到 P14 授权必须在同一个窗口里一口气完成，中途不要关闭浏览器。

**CC Switch**：只有用户在 P16 选择用 CC Switch 时才需要安装，这里先不装。

---

## P13 [用户] 注册并订阅 Claude Pro

AI 只能指导，这一步必须用户本人操作。检查点内容：

**资料清单**

- 海外邮箱（Gmail / Outlook）
- 能收短信的海外手机号（Anthropic 不支持 `+86`）
- 与服务器同地区发行的 Visa / Mastercard，开通境外线上支付，余额略高于 `$22`
- **账单地址：填写这张卡在银行登记的真实账单地址**

**步骤**

1. 在**刚才自检通过的 Mullvad 窗口**里打开 <https://claude.ai>，用邮箱注册，再完成手机短信验证。
2. 进入聊天页后先发一句 `hi`，确认账号正常。刚注册时不要频繁刷新，也不要发奇怪的测试内容。
3. 左下角头像 → **Upgrade to Pro**（或打开 <https://claude.ai/upgrade>），建议先选**按月订阅** `$20/月`。
4. 在 Stripe 支付页填写卡信息。**Billing Address 的国家必须与服务器地区、发卡地区一致**。完成手机银行 3DS 验证后，页面出现 **Pro** 标志即成功。
5. **不要关闭 Mullvad 窗口**，直接回复「完成」。

**支付被拒时**

- 不要在几分钟内反复换卡重试，容易触发 Stripe 长期风控。
- 先核对三点：卡是否开通境外线上支付、余额是否足够、IP / 发卡地 / 账单地址三者是否一致。
- 也可以用同一账号，在手机上通过对应地区的 Apple ID / Google Play 内购订阅。

---

## P14 [AI+用户] 通过 SSH 隧道把 Claude 账号授权给 CPA

**原理**（用户问起时解释）：Anthropic 授权完成后，会让浏览器跳回本机的 `http://localhost:54545/callback`。真正接收回调的 CPA 运行在远程服务器上，所以要用 SSH 隧道把本机的 `54545` 端口转发到服务器。

**P14.1 [AI] 后台建立隧道**

用你的后台执行能力运行，整个 P14 期间保持运行：

```bash
ssh -N -o ExitOnForwardFailure=yes -L 54545:127.0.0.1:54545 lightsail
```

你没有后台执行能力时，让用户在一个新终端里运行这条命令，并保持窗口打开。

验证本机端口已在监听：

```bash
python3 -c "import socket; s=socket.create_connection(('127.0.0.1',54545),3); print('tunnel ok')"
```

**P14.2 [AI] 生成授权链接并放进剪贴板**

```bash
. ~/.lsg/env.sh
printf 'Authorization: Bearer %s\n' "$CPA_MGMT_KEY" | \
  ssh lightsail 'curl -fsS -H @- "http://127.0.0.1:8317/v0/management/anthropic-auth-url?is_webui=true"' > ~/.lsg/oauth.json
chmod 600 ~/.lsg/oauth.json
J='import json,pathlib; d=json.loads((pathlib.Path.home()/".lsg/oauth.json").read_text())'
python3 -c "$J; print(d.get('status'), d.get('state'))"           # expect: ok <state>
python3 -c "$J; print(d.get('url',''), end='')" | clip.exe          # macOS: pbcopy ; Linux: xclip -selection clipboard
```

接口返回失败时，退回网页方式：让用户在同一个 Mullvad 窗口新开标签页，打开 `https://api.<DOMAIN>/management.html`，用 `CPA_MGMT_KEY` 登录（让用户从 `secrets.env` 里自己复制），在 OAuth 区域选 Claude 生成授权链接。

**P14.3 [用户] 授权**

1. 在**同一个 Mullvad 窗口**里新开标签页，按 `Ctrl+V` 粘贴授权链接并打开。这样会复用刚登录的 Claude Pro 会话，IP 也保持一致。
2. 点击 **Authorize**。
3. 浏览器会跳到 `http://localhost:54545/callback?...`，页面提示成功即可。
4. 如果弹出 **HTTPS-Only Mode Alert**，点 **Continue to HTTP Site**。仍然打不开时：
   - 把地址栏里完整的 `http://localhost:54545/callback?...` 复制下来；
   - 粘贴到 AI 帮你打开的 `~/.lsg/callback.txt` 里保存（这个授权码只能用一次，几分钟后失效）；
   - 告诉 AI「已保存回调链接」。

**P14.4 [AI] 确认授权结果**

```bash
. ~/.lsg/env.sh
STATE=$(python3 -c "import json,pathlib; print(json.loads((pathlib.Path.home()/'.lsg/oauth.json').read_text())['state'])")
for i in $(seq 1 30); do
  r=$(printf 'Authorization: Bearer %s\n' "$CPA_MGMT_KEY" | ssh lightsail "curl -fsS -H @- 'http://127.0.0.1:8317/v0/management/get-auth-status?state=$STATE'")
  echo "$r" | grep -q '"ok"' && { echo "auth ok"; break; }
  echo "$r" | grep -q '"error"' && { echo "$r"; break; }
  sleep 5
done
ssh lightsail 'sudo ls -1 /opt/cliproxyapi/auths/ | grep -i claude'   # file names only, never cat
```

用户保存了回调链接时，从本机直接请求它。请求经隧道送到 CPA，并且必须绕过系统代理：

```bash
curl -s --noproxy '*' "$(tr -d '\r\n' < ~/.lsg/callback.txt)" -o /dev/null -w "%{http_code}\n" && rm -f ~/.lsg/callback.txt
```

---

## P15 [AI] 验证模型列表并关闭隧道

```bash
. ~/.lsg/env.sh
printf 'Authorization: Bearer %s\n' "$CPA_CLIENT_KEY" | curl -fsS -H @- "https://api.$DOMAIN/v1/models" | \
  python3 -c "import sys,json; print('\n'.join(sorted(m['id'] for m in json.load(sys.stdin).get('data', []))))"
```

- 列表里出现 `claude-opus-…`、`claude-sonnet-…`、`claude-haiku-…`，说明 OAuth 接入成功。
- 每个系列取版本最新的一个 ID，写入 `vars.env` 的 `MODEL_OPUS`、`MODEL_SONNET`、`MODEL_HAIKU`。
- 结束 P14.1 的隧道进程。
- 告诉用户：现在可以关闭 Mullvad 浏览器了，CPA 会在服务器端自动刷新 OAuth Token。

---

## P16 [AI] 配置 Claude Code 并实测

**P16.1 [AI] 安装 Claude Code**（`claude --version` 能运行时跳过）

- Windows（PowerShell）：

  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```

- macOS / Linux：

  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

- 备选：先装 Node.js 18+，再 `npm install -g @anthropic-ai/claude-code`。
- 国内网络下载失败时，确认 v2rayN 系统代理已开启。npm 需要额外设置：`npm config set proxy http://127.0.0.1:<LOCAL_PROXY_PORT>`。

**P16.2 问用户选择配置方式**

- **方式 1（推荐，全自动）**：AI 直接写入 `~/.claude/settings.json`。
- **方式 2**：用 CC Switch 图形界面管理。适合还要在多个服务商之间切换的人。

两种方式二选一。CC Switch 启用供应商时会覆盖 `settings.json` 里的同名设置。

**如果正在执行本懒人包的 AI 就是 Claude Code**，先提醒用户：改完 `settings.json` 后，之后新开的 Claude Code 会话都会走这套 CPA。当前会话不受影响。征得同意后再改。

**方式 1：AI 写入 settings.json**

先备份，只合并 `env` 字段：

```bash
. ~/.lsg/env.sh
python3 - <<'PY'
import json, os, pathlib, shutil, time
p = pathlib.Path.home() / ".claude" / "settings.json"
p.parent.mkdir(exist_ok=True)
data = {}
if p.exists():
    shutil.copy2(p, p.with_name("settings.json.bak." + time.strftime("%Y%m%d%H%M%S")))
    data = json.loads(p.read_text(encoding="utf-8") or "{}")
env = data.setdefault("env", {})
e = os.environ
env.update({
    "ANTHROPIC_BASE_URL": f"https://api.{e['DOMAIN']}",   # no /v1 for Claude Code
    "ANTHROPIC_AUTH_TOKEN": e["CPA_CLIENT_KEY"],
    "ANTHROPIC_DEFAULT_OPUS_MODEL": e["MODEL_OPUS"],
    "ANTHROPIC_DEFAULT_SONNET_MODEL": e["MODEL_SONNET"],
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": e["MODEL_HAIKU"],
})
env.pop("ANTHROPIC_API_KEY", None)  # would override the auth token
p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("settings.json updated")
PY
```

**方式 2：CC Switch**

1. [AI] 从 <https://github.com/farion1231/cc-switch/releases> 下载安装包：Windows 用 `CC-Switch-<版本>-Windows-x86_64.msi`，或便携版 zip。运行安装。
2. [AI] 把客户端密钥放进剪贴板：

   ```bash
   . ~/.lsg/env.sh && printf '%s' "$CPA_CLIENT_KEY" | clip.exe
   ```

3. [用户] 打开 CC Switch，顶部选 **Claude Code** → **添加供应商** → **自定义**，按下表填写，保存后点 **启用**：

| 字段 | 值 |
| --- | --- |
| 供应商名称 | `Lightsail-CPA` |
| Base URL | `https://api.<DOMAIN>`（AI 告诉你）。**末尾不要带 `/v1`**，Claude Code 会自己拼接 `/v1/messages`；只有 Cherry Studio、Chatbox 等 OpenAI 协议客户端才填 `/v1` |
| API Key / Auth Token | 按 `Ctrl+V` 粘贴（客户端密钥，**不是**管理密钥） |
| Opus / Sonnet / Haiku 模型 | AI 告诉你的 `MODEL_OPUS` / `MODEL_SONNET` / `MODEL_HAIKU` |

**P16.3 [AI] 实测**

在新进程中运行：

```bash
claude -p "reply ok"
ssh lightsail 'sudo docker logs --tail 20 cli-proxy-api'
```

终端回复 `ok`，并且 CPA 日志里有刚才的请求，就说明全链路已打通。

---

## P17 [AI] 收尾、备份与交付

1. **[用户] 删除 IAM 访问密钥**（仅路线 A）：IAM → Users → `lsg-cli` → **Security credentials**，把访问密钥设为 **Inactive** 或删除。以后需要 AI 再操作 Lightsail 时，重新创建一个即可。用户确认后，AI 删除本机 `~/.aws/credentials` 里对应的配置（删除前先确认）。
2. **[AI] 备份到本机**：

   ```bash
   ts=$(date +%Y%m%d)
   ssh lightsail 'sudo tar czf - -C /opt/cliproxyapi config.yaml auths -C /etc/x-ui . 2>/dev/null' > ~/.lsg/backup/server-$ts.tgz
   chmod 600 ~/.lsg/backup/server-$ts.tgz
   ```

   告诉用户：这个文件里有凭证，建议加密后离线保存，**不要上传网盘公开链接或 GitHub**。
3. **[AI] 交付报告**（不含任何密钥），包括：
   - 已完成的步骤
   - 服务器 IP、各子域名用途
   - 面板地址 `https://<PANEL_SUB>.<DOMAIN>/<PANEL_PATH>/`
   - 密钥保存位置 `~/.lsg/secrets.env`
   - 备份文件路径
   - 下面的“日常守则”
4. **日常守则**（原样转告用户）：
   - 平时固定通过 CPA 走服务器的固定 IP，少在不同节点、不同设备之间反复登录 Claude 网页版。
   - Pro 订阅有 5 小时滚动额度，并发太高会触发 429 限流。遇到时等待冷却，不要短时间反复重试。
   - `sk-cpa-…` 客户端密钥能调用全部模型，没有按人限额，不要外传。想分享给朋友，应在 CPA 前面再部署一层 New API，按人发子密钥。
   - 定期备份服务器上的 `/opt/cliproxyapi/config.yaml` 与 `/opt/cliproxyapi/auths/`。

---

## 常见问题速查（AI 排错用）

| 现象 | 原因与处理 |
| --- | --- |
| 订阅里的节点地址是 `127.0.0.1` | 入站没有设置外部地址，回到 P8.5 的“订阅里的外部地址” |
| 节点域名直连打不开或证书错误 | Reality `target` 没指向 `127.0.0.1:8443`，或 `serverNames` 与 Nginx 分流的域名不一致 |
| v6 节点测速超时 | 本地宽带没有 IPv6，属正常，用 v4 节点 |
| `certbot renew --dry-run` 失败 | 签发后不到 1 小时，旧 TXT 缓存未过期，稍后再试 |
| CPA 管理页返回 403 | 管理密钥连续输错导致临时封禁，等待一段时间；检查是否误用了客户端密钥 |
| OAuth 授权后一直转圈或超时 | Mullvad 没有排除 `localhost`（P12），或 SSH 隧道没在运行（P14.1） |
| 授权回调页被 HTTPS-Only 拦截 | 点 **Continue to HTTP Site**，或按 P14.4 由 AI 在本机请求回调链接 |
| `claude -p` 报 404 | Base URL 多写了 `/v1` |
| `claude -p` 报 401 | 填成了管理密钥，或 `settings.json` 里残留 `ANTHROPIC_API_KEY` |
| 浏览器出口 IP 不是服务器 IP | v2rayN 没有选中自建 v4 节点、系统代理没开，或 `user.js` 端口与 v2rayN 不一致 |
| Docker 日志报配置字段错误 | CPA 配置格式有更新，对照上游 `config.example.yaml` 调整 `cpa-config.yaml` |

---

## 附录：模板文件

在 P0.4 保存到 `~/.lsg/templates/<文件名>`，使用时由 AI 替换占位符。

### site-index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Personal Notes</title>
  <style>
    body{max-width:680px;margin:60px auto;padding:0 20px;font:16px/1.7 system-ui,sans-serif;color:#222}
    @media(prefers-color-scheme:dark){body{background:#111;color:#ddd}}
    h1{font-size:1.5rem} li{margin:.6rem 0} small{color:#888}
  </style>
</head>
<body>
  <h1>Notes &amp; Bookmarks</h1>
  <p>Personal technical archive.</p>
  <ul>
    <li>Linux systemd timer notes <small>2026-10-12</small></li>
    <li>Nginx stream SNI routing snippet <small>2026-10-18</small></li>
  </ul>
</body>
</html>
```

### ssl-cert.conf

```nginx
ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
```

### proxy-stream.conf

```nginx
stream {
    map $ssl_preread_server_name $v4_backend {
        __NODE__-v4.__DOMAIN__ reality_tcp_v4;
        __NODE__-x.__DOMAIN__  reality_xhttp_v4;
        default                nginx_https;
    }
    map $ssl_preread_server_name $v6_backend {
        __NODE__-v6.__DOMAIN__ reality_tcp_v6;
        __NODE__-x.__DOMAIN__  reality_xhttp_v6;
        default                nginx_https;
    }

    upstream reality_tcp_v4   { server 127.0.0.1:10000; }
    upstream reality_xhttp_v4 { server 127.0.0.1:10009; }
    upstream reality_tcp_v6   { server 127.0.0.1:10010; }
    upstream reality_xhttp_v6 { server 127.0.0.1:10019; }
    upstream nginx_https      { server 127.0.0.1:8443; }

    server {
        listen 0.0.0.0:443 reuseport;
        proxy_pass $v4_backend;
        ssl_preread on;
        proxy_connect_timeout 5s;
        proxy_timeout 30m;
    }
    server {
        listen [::]:443 ipv6only=on reuseport;
        proxy_pass $v6_backend;
        ssl_preread on;
        proxy_connect_timeout 5s;
        proxy_timeout 30m;
    }
}
```

### proxy.conf

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 127.0.0.1:8443 ssl http2 default_server;
    server_name _;
    include /etc/nginx/snippets/ssl-cert.conf;
    return 404;
}

# Subscription site + Reality fallback page
server {
    listen 127.0.0.1:8443 ssl http2;
    server_name sub.__DOMAIN__ __NODE__-v4.__DOMAIN__ __NODE__-v6.__DOMAIN__ __NODE__-x.__DOMAIN__;
    include /etc/nginx/snippets/ssl-cert.conf;

    location /sub/ {
        proxy_pass http://127.0.0.1:2096;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
    location / {
        root /var/www/site;
        index index.html;
        try_files $uri $uri/ =404;
    }
}

# 3x-ui panel
server {
    listen 127.0.0.1:8443 ssl http2;
    server_name __PANEL_SUB__.__DOMAIN__;
    include /etc/nginx/snippets/ssl-cert.conf;

    location / {
        proxy_pass http://127.0.0.1:54321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### certbot 续期命令（不是模板文件，P6 里直接在服务器执行）

```bash
sudo tee /etc/systemd/system/certbot.service >/dev/null <<'EOF'
[Unit]
Description=Certbot renewal (venv)
[Service]
Type=oneshot
ExecStart=/opt/certbot/bin/certbot -q renew
EOF

sudo tee /etc/systemd/system/certbot.timer >/dev/null <<'EOF'
[Unit]
Description=Run certbot renew twice daily
[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=43200
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh >/dev/null <<'EOF'
#!/bin/sh
set -e
systemctl reload nginx
systemctl restart x-ui 2>/dev/null || true
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### hy2-porthop.sh 与 hy2-porthop.service

`hy2-porthop.sh`（未启用 IPv6 时可删掉 `ip6tables` 相关行）：

```sh
#!/bin/sh
case "$1" in
  start)
    iptables  -t nat -C PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination __BIND4__:443 2>/dev/null || \
    iptables  -t nat -A PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination __BIND4__:443
    ip6tables -t nat -C PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination [__PUB6__]:443 2>/dev/null || \
    ip6tables -t nat -A PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination [__PUB6__]:443
    ;;
  stop)
    iptables  -t nat -D PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination __BIND4__:443 2>/dev/null || true
    ip6tables -t nat -D PREROUTING -i __NIC__ -p udp --dport 20000:50000 -j DNAT --to-destination [__PUB6__]:443 2>/dev/null || true
    ;;
esac
```

`hy2-porthop.service`：

```ini
[Unit]
Description=Hysteria2 UDP port hopping (20000-50000 -> 443)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/hy2-porthop.sh start
ExecStop=/usr/local/sbin/hy2-porthop.sh stop

[Install]
WantedBy=multi-user.target
```

### cpa-config.yaml

```yaml
# CLIProxyAPI config (config-version 8 layout). If the container reports unknown/renamed
# fields, align with the upstream config.example.yaml of the pulled image.
server:
  host: ""
  port: 8317

management:
  allow-remote: true          # requests arrive via nginx/docker, not from container localhost
  secret-key: "__CPA_MGMT_KEY__"

access:
  api-keys:
    - "__CPA_CLIENT_KEY__"

oauth:
  auth-dir: "~/.cli-proxy-api"
```

### cpa-docker-compose.yml

```yaml
services:
  cli-proxy-api:
    image: eceasy/cli-proxy-api:latest   # pin a version tag for production
    container_name: cli-proxy-api
    ports:
      - "127.0.0.1:8317:8317"     # API + management page
      - "127.0.0.1:54545:54545"   # Claude OAuth callback
      - "127.0.0.1:1455:1455"     # Codex OAuth callback
      - "127.0.0.1:8085:8085"     # Gemini OAuth callback
    volumes:
      - ./config.yaml:/CLIProxyAPI/config.yaml
      - ./auths:/root/.cli-proxy-api
      - ./logs:/CLIProxyAPI/logs
      - ./plugins:/CLIProxyAPI/plugins
    restart: unless-stopped
```

### cliproxyapi.conf

```nginx
server {
    listen 127.0.0.1:8443 ssl http2;
    server_name api.__DOMAIN__;
    include /etc/nginx/snippets/ssl-cert.conf;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8317;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $http_connection;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;

        # Disable buffering and extend timeouts so streamed (SSE) output and long thinking don't stall
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }
}
```

### xui_api.py

```python
#!/usr/bin/env python3
"""Minimal 3x-ui API client for the lazy pack.

Usage: sudo python3 xui_api.py GET|POST <path> [-]
  <path>  e.g. /panel/api/inbounds/list (the webBasePath is prepended automatically)
  -       read the JSON request body from stdin
Reads /root/lsg/xui.json: {"base": "http://127.0.0.1:54321/<webBasePath>", "token": "<api token>"}
"""
import json
import sys
import urllib.error
import urllib.request

cfg = json.load(open("/root/lsg/xui.json"))
method, path = sys.argv[1].upper(), sys.argv[2]
body = sys.stdin.read().encode() if len(sys.argv) > 3 and sys.argv[3] == "-" else None
if method == "POST" and body is None:
    body = b"{}"
req = urllib.request.Request(
    cfg["base"].rstrip("/") + path,
    data=body,
    method=method,
    headers={
        "Authorization": "Bearer " + cfg["token"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        print(r.read().decode())
except urllib.error.HTTPError as e:
    print(json.dumps({"http_error": e.code, "body": e.read().decode()[:2000]}))
    sys.exit(1)
```

### mullvad-user.js

```js
// Route Mullvad Browser through the local v2rayN SOCKS5 port; keep localhost direct for the OAuth callback.
user_pref("network.proxy.type", 1);
user_pref("network.proxy.socks", "127.0.0.1");
user_pref("network.proxy.socks_port", __LOCAL_PROXY_PORT__);
user_pref("network.proxy.socks_version", 5);
user_pref("network.proxy.socks_remote_dns", true);
user_pref("network.proxy.no_proxies_on", "localhost, 127.0.0.1");
user_pref("network.proxy.allow_hijacking_localhost", false);
```
