#!/usr/bin/env python3
"""Parse a WhatsApp group export into aggregated analytics JSON.

The raw chat is never written to the repo — only counts, rankings, and
sanitized highlight snippets (no phone numbers, URLs, or credentials).
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAT = Path("/home/ubuntu/.cursor/projects/workspace/uploads/_chat_6a44.txt")
OUT = ROOT / "data/imo-analytics.json"

HEADER = re.compile(
    r"^[\u200e\u200f\ufeff]*\[(\d{1,2}/\d{1,2}/\d{2,4}),\s+(\d{1,2}\.\d{2}\.\d{2})\]\s+(.+)$"
)

FORMAT_CHARS = dict.fromkeys(
    map(
        ord,
        "\u200e\u200f\ufeff\u2068\u2069\u2066\u2067\u202a\u202b\u202c\u202d\u202e\u00a0\u202f",
    )
)

SYSTEM_PATTERNS = (
    "end-to-end encrypted",
    "created this group",
    "added you",
    "added ",
    "left",
    "removed",
    "changed the group name",
    "changed this group's icon",
    "changed the subject",
    "joined using this group's invite link",
    "you're now an admin",
    "you're no longer an admin",
    "changed to an admin",
    "changed this group's settings",
    "turned on disappearing messages",
    "turned off disappearing messages",
    "waiting for this message",
    "missed voice call",
    "missed video call",
    "started a call",
    "security code changed",
    "changed their phone number",
)

MEDIA_MAP = {
    "image omitted": "image",
    "video omitted": "video",
    "sticker omitted": "sticker",
    "audio omitted": "audio",
    "document omitted": "document",
    "gif omitted": "gif",
    "contact card omitted": "contact",
}

ALIASES = {
    "~ rini carolina": "Rini IMO Pelindo",
    "~rini carolina": "Rini IMO Pelindo",
    "rini carolina": "Rini IMO Pelindo",
}

BOTS = {"meta ai"}

STOPWORDS = {
    "yang", "yg", "dan", "di", "ke", "dari", "untuk", "dengan", "ada", "ini",
    "itu", "ya", "yaa", "yaaa", "yah", "yuk", "yok", "sih", "dong", "deh",
    "kok", "kan", "lah", "pun", "juga", "jg", "sudah", "udah", "sdh", "belum",
    "blm", "bisa", "bs", "tidak", "tdk", "gak", "ga", "gk", "nggak", "enggak",
    "kalau", "kalo", "klo", "kl", "karena", "krn", "karna", "atau", "tapi",
    "tp", "jadi", "jd", "akan", "mau", "masih", "msh", "sangat", "banget",
    "bgt", "paling", "lebih", "kurang", "banyak", "semua", "smua", "satu",
    "hari", "jam", "nanti", "ntar", "kemarin", "kmrn", "besok", "sekarang",
    "skrg", "skg", "tadi", "baru", "saya", "aku", "gw", "gue", "gua", "kamu",
    "kita", "kami", "dia", "pak", "bu", "mas", "mba", "mbak", "kak", "kakak",
    "bang", "om", "bro", "guys", "gaes", "ges", "tmn", "the", "and", "for",
    "with", "this", "that", "from", "are", "was", "were", "have", "has", "not",
    "but", "you", "your", "our", "nya", "nih", "tuh", "loh", "lho", "si", "ni",
    "tu", "aja", "doang", "cuma", "cuman", "hanya", "thanks", "thank", "thx",
    "makasih", "mksh", "maaf", "sorry", "oke", "ok", "okay", "siap", "sip",
    "noted", "http", "https", "www", "com", "zoom", "join", "meeting",
    "image", "omitted", "sticker", "video", "document", "deleted", "message",
    "group", "name", "added", "wkwk", "wkwkwk", "haha", "hahaha", "hehe",
    "lol", "amin", "aamiin", "dah", "udh", "lg", "lagi", "dulu", "dl", "dll",
    "buat", "biar", "agar", "soalnya", "soal", "emang", "memang", "emg", "mmg",
    "kayak", "kaya", "kyk", "gimana", "gmn", "kenapa", "knp", "apa", "siapa",
    "kapan", "berapa", "brp", "mana", "ayo", "tolong", "tlg", "mohon", "boleh",
    "harus", "hrs", "perlu", "jangan", "jgn", "udah", "pagi", "siang", "sore",
    "malam", "malem", "wib", "via", "on", "in", "at", "to", "of", "as", "is",
    "be", "or", "if", "so", "we", "just", "only", "also", "still", "even",
    "very", "too", "then", "yes", "no", "now", "gitu", "gini", "begitu",
    "begini", "kayaknya", "mungkin", "cm", "saja", "trs", "terus", "trus",
    "lalu", "org", "orang", "nah", "iya", "bukan", "pake", "pas", "makin",
    "kali", "dalam", "pasti", "tau", "langsung", "selalu", "udah", "udah",
    "info", "file", "min", "admin", "copy", "update", "ss", "biarin",
    "seperti", "masuk", "bener", "benar", "sama", "sm", "dgn", "dr",
    "pd", "spt", "iyaa", "iyes", "yoi", "pada", "tahun", "edited",
}

# Keep nicknames out of generic stopwords so we can surface them separately.
NICKNAMES = {
    "her": "Hermawan IPC",
    "tif": "Mr Tifta",
    "tifta": "Mr Tifta",
    "sultif": "Mr Tifta",
    "ical": "Yulisar IPC",
    "uki": "Lucky IPC",
    "dak": "Danti IPC",
}

TOPICS = [
    {
        "id": "kpi",
        "label": "KPI, KAI & alokasi",
        "blurb": "Kamus KPI, bobot, target, My Team, BOPO, output, change management.",
        "keys": (
            r"\bkpi\b", r"\bkai\b", r"kamus kpi", r"\balokasi\b", r"\bbopo\b",
            r"change management", r"my team", r"kpi count",
        ),
    },
    {
        "id": "proker",
        "label": "Program kerja",
        "blurb": "Proker, progress, tasklist, missing sheet, Dirinvest.",
        "keys": (
            r"proker", r"program kerja", r"tasklist", r"task list",
            r"missing sheet", r"dirinvest", r"alokasi modal",
        ),
    },
    {
        "id": "rapat",
        "label": "Rapat & Zoom",
        "blurb": "Undangan, konsinyering, daftar hadir, VC, Google Meet.",
        "keys": (
            r"\bzoom\b", r"\bmeeting\b", r"\brapat\b", r"konsinyering",
            r"undangan", r"daftar hadir", r"\bgmeet\b", r"google meet",
        ),
    },
    {
        "id": "excel",
        "label": "Excel & rumus",
        "blurb": "Worksheet, spreadsheet, template, protect sheet.",
        "keys": (
            r"\bexcel\b", r"\brumus\b", r"worksheet", r"spreadsheet",
            r"\bxlsx?\b", r"google sheet", r"protect worksheet",
        ),
    },
    {
        "id": "investasi",
        "label": "Investasi & pasar",
        "blurb": "Saham, IPO, IHSG, reksadana, portofolio.",
        "keys": (
            r"investasi", r"\bipo\b", r"\bsaham\b", r"\bihsg\b", r"reksadana",
            r"portofolio", r"\byield\b", r"\bobligasi\b",
        ),
    },
    {
        "id": "sistem",
        "label": "Sistem, aplikasi & AI",
        "blurb": "Aplikasi internal, vendor, Office 365, dashboard, AI.",
        "keys": (
            r"\baplikasi\b", r"\bvendor\b", r"office 365", r"\bdashboard\b",
            r"usermanual", r"user manual", r"\bpakai ai\b", r"\bpake ai\b",
            r"\bmeta ai\b",
        ),
    },
    {
        "id": "organisasi",
        "label": "Direksi & organisasi",
        "blurb": "Direksi, komisaris, Group Head, transformasi Pelindo.",
        "keys": (
            r"direksi", r"komisaris", r"pelindo", r"group head",
            r"\btransformasi\b", r"\bintegrasi\b", r"\bgh keuangan\b",
        ),
    },
    {
        "id": "kesehatan",
        "label": "Kesehatan & pandemi",
        "blurb": "Prokes, masker, COVID, WFH, wisma.",
        "keys": (
            r"covid", r"prokes", r"masker", r"\bwfh\b", r"pandemi",
            r"wisma", r"vaksin", r"isoman", r"\bpcr\b", r"antigen",
        ),
    },
    {
        "id": "sosial",
        "label": "Sosial & ucapan",
        "blurb": "Makan siang, ultah, ucapan selamat, kopi.",
        "keys": (
            r"\bmakan\b", r"\blunch\b", r"sarapan", r"\bultah\b",
            r"ulang tahun", r"selamat", r"\bkopi\b", r"\bcanda\b",
        ),
    },
    {
        "id": "perjalanan",
        "label": "Dinas, cuti & libur",
        "blurb": "Perjalanan dinas, cuti, lebaran, natal, tahun baru.",
        "keys": (
            r"\bdinas\b", r"\bcuti\b", r"lebaran", r"\bnatal\b", r"\blibur\b",
            r"tahun baru", r"\boffsite\b", r"luar kota",
        ),
    },
    {
        "id": "anggaran",
        "label": "Anggaran & RKAP",
        "blurb": "RKAP, capex, opex, budget, realisasi.",
        "keys": (
            r"\brkap\b", r"anggaran", r"\bcapex\b", r"\bopex\b", r"\bbudget\b",
            r"realisasi",
        ),
    },
    {
        "id": "belajar",
        "label": "Pelatihan & knowledge",
        "blurb": "Pelatihan, training, sertifikasi, knowledge portal.",
        "keys": (
            r"pelatihan", r"\btraining\b", r"sertifikasi", r"knowledge",
            r"portaverse", r"\bbelajar\b",
        ),
    },
]

EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F6FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "]",
    flags=re.UNICODE,
)
MENTION_RE = re.compile(r"@\s*([^@\n]{1,80}?)(?=\s{2,}|\s*$|@|,|\.|!|\?|\n)")
URL_RE = re.compile(r"https?://\S+", re.I)
PHONE_RE = re.compile(r"\+?62[\s\-\u2011]*\d[\d\s\-\u2011]{6,}")
WORD_RE = re.compile(r"[A-Za-zÀ-ÿ0-9]+", re.U)
NAME_CHANGE_RE = re.compile(r"changed the group name to [“\"'](.+?)[”\"']", re.I)
SKIN_TONE = re.compile("[\U0001F3FB-\U0001F3FF\uFE0F]")


def clean(s: str) -> str:
    s = s.translate(FORMAT_CHARS)
    s = s.replace("\u2011", "-")
    return unicodedata.normalize("NFC", s).strip()


def mask_phone(s: str) -> str:
    def repl(m: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        tail = digits[-4:] if len(digits) >= 4 else digits
        return f"Pembuat grup (·{tail})"

    return PHONE_RE.sub(repl, s)


def display_name(raw: str) -> str:
    name = mask_phone(clean(raw))
    key = name.lower().lstrip("~ ").strip()
    if name in {"IMO FACTORY", "You"}:
        return "Akun ekspor (You)"
    if key in ALIASES:
        return ALIASES[key]
    if name.startswith("~ "):
        name = name[2:].strip()
    return name


def parse_dt(date_s: str, time_s: str) -> datetime:
    d, m, y = date_s.split("/")
    year = int(y)
    if year < 100:
        year += 2000
    hh, mm, ss = (int(x) for x in time_s.split("."))
    return datetime(year, int(m), int(d), hh, mm, ss)


def split_sender(rest: str) -> tuple[str, str]:
    idx = rest.find(": ")
    if idx == -1:
        idx = rest.find(":")
        if idx == -1:
            return rest.strip(), ""
        return rest[:idx].strip(), rest[idx + 1 :].strip()
    return rest[:idx].strip(), rest[idx + 2 :]


def is_system(body: str) -> bool:
    b = body.lower()
    if "this message was deleted" in b or "pesan ini dihapus" in b:
        return False
    return any(p in b for p in SYSTEM_PATTERNS)


def media_kind(body: str) -> str | None:
    b = clean(body).lower()
    for needle, kind in MEDIA_MAP.items():
        if needle in b:
            return kind
    return None


def tokenize(text: str) -> list[str]:
    text = URL_RE.sub(" ", text.lower())
    text = PHONE_RE.sub(" ", text)
    words = []
    for w in WORD_RE.findall(text):
        if len(w) < 3 or w.isdigit() or w in STOPWORDS:
            continue
        words.append(w)
    return words


def topic_hits(text: str) -> list[str]:
    t = text.lower()
    return [topic["id"] for topic in TOPICS if any(re.search(k, t, flags=re.I) for k in topic["keys"])]


def classify(body: str) -> str:
    kind = media_kind(body)
    if kind:
        return kind
    b = body.lower()
    if "this message was deleted" in b or "pesan ini dihapus" in b:
        return "deleted"
    if is_system(body):
        return "system"
    return "text"


def load_messages(path: Path) -> list[dict]:
    messages: list[dict] = []
    current: dict | None = None
    with path.open(encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip("\n")
            m = HEADER.match(line)
            if m:
                if current:
                    messages.append(current)
                rest = m.group(3)
                sender, body = split_sender(rest)
                current = {
                    "dt": parse_dt(m.group(1), m.group(2)),
                    "sender": display_name(sender),
                    "body": body,
                }
            elif current is not None:
                current["body"] += "\n" + line
        if current:
            messages.append(current)
    return messages


def longest_silence(sorted_dts: list[datetime]) -> dict:
    best = timedelta(0)
    a = b = sorted_dts[0]
    for x, y in zip(sorted_dts, sorted_dts[1:]):
        gap = y - x
        if gap > best:
            best = gap
            a, b = x, y
    return {
        "days": round(best.total_seconds() / 86400, 1),
        "from": a.date().isoformat(),
        "to": b.date().isoformat(),
    }


def fmt_id(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def main() -> None:
    msgs = load_messages(CHAT)
    user_msgs = [m for m in msgs if classify(m["body"]) != "system"]
    start = msgs[0]["dt"]
    end = msgs[-1]["dt"]
    span_days = max((end - start).days, 1)

    kind_counts = Counter(classify(m["body"]) for m in msgs)
    hour_counts = Counter(m["dt"].hour for m in user_msgs)
    dow_counts = Counter(m["dt"].weekday() for m in user_msgs)
    month_counts: dict[str, int] = defaultdict(int)
    year_counts: dict[str, int] = defaultdict(int)
    day_counts: dict[str, int] = defaultdict(int)
    heatmap: dict[tuple[int, int], int] = defaultdict(int)
    for m in user_msgs:
        month_counts[m["dt"].strftime("%Y-%m")] += 1
        year_counts[str(m["dt"].year)] += 1
        day_counts[m["dt"].strftime("%Y-%m-%d")] += 1
        heatmap[(m["dt"].weekday(), m["dt"].hour)] += 1

    members: dict[str, dict] = {}
    mention_counts: Counter[str] = Counter()
    emoji_counts: Counter[str] = Counter()
    topic_counts: Counter[str] = Counter()
    topic_by_year: dict[str, Counter[str]] = defaultdict(Counter)
    word_counts: Counter[str] = Counter()
    nick_counts: Counter[str] = Counter()
    name_history: list[dict] = []
    url_hosts: Counter[str] = Counter()
    tagged_text = 0

    for m in msgs:
        body_clean = clean(m["body"])
        kind = classify(m["body"])
        name = m["sender"]
        if kind == "system":
            nm = NAME_CHANGE_RE.search(body_clean)
            if nm:
                name_history.append(
                    {
                        "at": m["dt"].date().isoformat(),
                        "name": nm.group(1),
                        "by": name,
                    }
                )
            continue

        rec = members.setdefault(
            name,
            {
                "name": name,
                "messages": 0,
                "text": 0,
                "stickers": 0,
                "images": 0,
                "videos": 0,
                "audio": 0,
                "documents": 0,
                "gifs": 0,
                "deleted": 0,
                "chars": 0,
                "emojis": 0,
                "mentions_given": 0,
                "hours": Counter(),
                "byYear": Counter(),
                "first": m["dt"],
                "last": m["dt"],
                "days": set(),
                "bot": name.lower() in BOTS,
            },
        )
        rec["messages"] += 1
        rec["last"] = m["dt"]
        rec["days"].add(m["dt"].date())
        rec["hours"][m["dt"].hour] += 1
        rec["byYear"][str(m["dt"].year)] += 1
        bucket = {
            "text": "text",
            "sticker": "stickers",
            "image": "images",
            "video": "videos",
            "audio": "audio",
            "document": "documents",
            "gif": "gifs",
            "deleted": "deleted",
        }.get(kind)
        if bucket:
            rec[bucket] += 1
        if kind == "text":
            rec["chars"] += len(body_clean)

        for em in EMOJI_RE.findall(body_clean):
            emoji_counts[em] += 1
            rec["emojis"] += 1

        # Mentions: WhatsApp wraps contacts as @Name — match against known members later
        for ment in re.findall(r"@([^\s@][^@\n]{0,70})", m["body"]):
            mentioned = display_name(ment)
            if mentioned and mentioned != name:
                mention_counts[mentioned] += 1
                rec["mentions_given"] += 1

        for url in URL_RE.findall(body_clean):
            host = re.sub(r"^https?://", "", url, flags=re.I).split("/")[0].lower()
            host = host.split(":")[0]
            if host and "zoom.us" not in host and "whatsapp.com" not in host:
                url_hosts[host] += 1

        if kind == "text":
            toks = tokenize(body_clean)
            word_counts.update(toks)
            for tok in toks:
                if tok in NICKNAMES:
                    nick_counts[tok] += 1
            hits = topic_hits(body_clean)
            if hits:
                tagged_text += 1
            for tid in hits:
                topic_counts[tid] += 1
                topic_by_year[str(m["dt"].year)][tid] += 1

    starters: Counter[str] = Counter()
    prev_dt: datetime | None = None
    for m in user_msgs:
        if prev_dt is None or (m["dt"] - prev_dt) >= timedelta(hours=2):
            starters[m["sender"]] += 1
        prev_dt = m["dt"]

    years = sorted(year_counts)
    member_rows = []
    for rec in members.values():
        hours = rec["hours"]
        peak_hour = max(hours, key=hours.get) if hours else 0
        after_hours = sum(v for h, v in hours.items() if h < 7 or h >= 18)
        silent_days = (end.date() - rec["last"].date()).days
        member_rows.append(
            {
                "name": rec["name"],
                "bot": rec["bot"],
                "messages": rec["messages"],
                "sharePct": round(100 * rec["messages"] / max(len(user_msgs), 1), 2),
                "text": rec["text"],
                "stickers": rec["stickers"],
                "images": rec["images"],
                "videos": rec["videos"],
                "documents": rec["documents"],
                "avgChars": round(rec["chars"] / rec["text"], 1) if rec["text"] else 0,
                "emojis": rec["emojis"],
                "mentionsGiven": rec["mentions_given"],
                "mentionsReceived": mention_counts.get(rec["name"], 0),
                "activeDays": len(rec["days"]),
                "peakHour": peak_hour,
                "afterHoursPct": round(100 * after_hours / rec["messages"], 1),
                "threadsStarted": starters.get(rec["name"], 0),
                "firstAt": rec["first"].date().isoformat(),
                "lastAt": rec["last"].date().isoformat(),
                "spanDays": (rec["last"].date() - rec["first"].date()).days + 1,
                "quietDays": silent_days,
                "alumni": silent_days > 180 and not rec["bot"],
                "byYear": {y: rec["byYear"].get(y, 0) for y in years},
            }
        )

    humans = [r for r in member_rows if not r["bot"]]
    humans.sort(key=lambda r: (-r["messages"], r["name"]))
    for i, row in enumerate(humans, 1):
        row["rank"] = i
    bots = [r for r in member_rows if r["bot"]]
    member_rows = humans + bots

    # Attach leftover mentions that didn't exact-match (fuzzy contains)
    for row in humans:
        if row["mentionsReceived"]:
            continue
        extra = 0
        for n, c in mention_counts.items():
            if row["name"].lower() in n.lower() or n.lower() in row["name"].lower():
                extra += c
        row["mentionsReceived"] = extra

    top_days = sorted(day_counts.items(), key=lambda x: -x[1])[:10]
    weekday_labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    hour_labels = [{"hour": h, "count": hour_counts.get(h, 0)} for h in range(24)]
    weekday_series = [{"day": weekday_labels[i], "count": dow_counts.get(i, 0)} for i in range(7)]
    monthly = [{"month": k, "count": month_counts[k]} for k in sorted(month_counts)]
    yearly = [{"year": k, "count": year_counts[k]} for k in sorted(year_counts)]
    heat = [
        {"dow": d, "day": weekday_labels[d], "hour": h, "count": heatmap.get((d, h), 0)}
        for d in range(7)
        for h in range(24)
    ]

    text_n = kind_counts.get("text", 1)
    topics_out = []
    for t in TOPICS:
        count = topic_counts.get(t["id"], 0)
        topics_out.append(
            {
                "id": t["id"],
                "label": t["label"],
                "blurb": t["blurb"],
                "messages": count,
                "sharePct": round(100 * count / text_n, 1),
                "byYear": {y: topic_by_year[y].get(t["id"], 0) for y in years},
            }
        )
    topics_out.sort(key=lambda t: -t["messages"])

    night = sum(hour_counts[h] for h in list(range(0, 6)) + [22, 23])
    office = sum(hour_counts[h] for h in range(9, 18))
    weekend = dow_counts.get(5, 0) + dow_counts.get(6, 0)

    def pick(key, pred=lambda r: True):
        pool = [r for r in humans if pred(r)]
        return max(pool, key=key) if pool else None

    sticker_king = pick(lambda r: r["stickers"])
    image_king = pick(lambda r: r["images"])
    mention_magnet = pick(lambda r: r["mentionsReceived"])
    thread_starter = pick(lambda r: r["threadsStarted"])
    night_owl = pick(lambda r: r["afterHoursPct"], lambda r: r["messages"] >= 80)
    long_writer = pick(lambda r: r["avgChars"], lambda r: r["text"] >= 80)
    most_days = pick(lambda r: r["activeDays"])
    emoji_king = pick(lambda r: r["emojis"])

    peak_day, peak_day_n = top_days[0]
    peak_month = max(monthly, key=lambda x: x["count"])
    peak_year = max(yearly, key=lambda x: x["count"])
    peak_hour = max(hour_labels, key=lambda x: x["count"])["hour"]
    top5_share = round(sum(r["sharePct"] for r in humans[:5]), 1)
    alumni = [r for r in humans if r["alumni"]]

    highlights = [
        {
            "kicker": "Usia grup",
            "title": f"{span_days} hari · {len(humans)} anggota",
            "body": (
                f"Obrolan dari {start.strftime('%-d %b %Y')} sampai "
                f"{end.strftime('%-d %b %Y')}. Rata-rata {len(user_msgs)/span_days:.1f} pesan per hari kalender, "
                f"median {sorted(day_counts.values())[len(day_counts)//2]} pada hari yang ada chat."
            ),
        },
        {
            "kicker": "Konsentrasi",
            "title": f"5 orang menulis {top5_share}% pesan",
            "body": (
                f"{', '.join(r['name'] for r in humans[:5])}. "
                f"{humans[0]['name']} di peringkat 1 dengan {fmt_id(humans[0]['messages'])} pesan "
                f"({humans[0]['sharePct']}%)."
            ),
        },
        {
            "kicker": "Tahun puncak",
            "title": f"{peak_year['year']} · {fmt_id(peak_year['count'])} pesan",
            "body": (
                f"Bulan tersibuk {peak_month['month']} ({fmt_id(peak_month['count'])} pesan). "
                f"Hari tersibuk {peak_day} dengan {fmt_id(peak_day_n)} pesan."
            ),
        },
        {
            "kicker": "Jam kerja",
            "title": f"{office / len(user_msgs) * 100:.0f}% masuk pukul 09–18",
            "body": (
                f"Puncak jam {peak_hour:02d}.00. Akhir pekan hanya {weekend / len(user_msgs) * 100:.0f}%. "
                f"Larut malam (22–05) {night / len(user_msgs) * 100:.0f}% — grup ini hidup di jam kantor."
            ),
        },
        {
            "kicker": "Media",
            "title": f"{fmt_id(kind_counts.get('sticker', 0))} stiker · {fmt_id(kind_counts.get('image', 0))} gambar",
            "body": (
                (f"{sticker_king['name']} raja stiker ({fmt_id(sticker_king['stickers'])}). " if sticker_king else "")
                + (f"{image_king['name']} paling banyak kirim gambar ({fmt_id(image_king['images'])})." if image_king else "")
            ),
        },
        {
            "kicker": "Identitas grup",
            "title": f"{len(name_history)} kali ganti nama",
            "body": " → ".join(h["name"] for h in name_history),
        },
    ]
    if mention_magnet:
        highlights.append(
            {
                "kicker": "Jaringan",
                "title": f"Paling di-tag: {mention_magnet['name']}",
                "body": (
                    f"{fmt_id(mention_magnet['mentionsReceived'])} mention. "
                    + (
                        f"Pembuka thread: {thread_starter['name']} ({fmt_id(thread_starter['threadsStarted'])} percakapan baru setelah jeda ≥2 jam)."
                        if thread_starter
                        else ""
                    )
                ),
            }
        )
    if most_days:
        highlights.append(
            {
                "kicker": "Konsistensi",
                "title": f"{most_days['name']} hadir {fmt_id(most_days['activeDays'])} hari",
                "body": "Bukan hanya volume — ini orang yang paling sering muncul di kalender grup.",
            },
        )
    if night_owl:
        highlights.append(
            {
                "kicker": "Night owl",
                "title": night_owl["name"],
                "body": f"{night_owl['afterHoursPct']}% pesannya di luar 07.00–18.00 (min. 80 pesan).",
            }
        )
    if long_writer:
        highlights.append(
            {
                "kicker": "Teks terpanjang",
                "title": long_writer["name"],
                "body": f"Rata-rata {long_writer['avgChars']} karakter per pesan — cenderung menjelaskan, bukan cuma react.",
            }
        )
    silence = longest_silence([m["dt"] for m in user_msgs])
    highlights.append(
        {
            "kicker": "Jedah terpanjang",
            "title": f"{silence['days']:.0f} hari sepi",
            "body": f"{silence['from']} → {silence['to']}.",
        }
    )
    if alumni:
        highlights.append(
            {
                "kicker": "Alumni",
                "title": f"{len(alumni)} anggota sudah >6 bulan sepi",
                "body": ", ".join(f"{r['name']} (terakhir {r['lastAt']})" for r in alumni),
            }
        )

    member_tokens = set()
    for row in humans[:20]:
        member_tokens.update(tokenize(row["name"]))
        member_tokens.update(row["name"].lower().split())
    top_words = [
        {"word": w, "count": c}
        for w, c in word_counts.most_common(120)
        if w not in member_tokens and w not in NICKNAMES and len(w) >= 4
    ][:36]

    payload = {
        "meta": {
            "groupLabel": "IMO FACTORY",
            "subtitle": "Analitik grup WhatsApp IMO · Pelindo / IPC",
            "source": "Ekspor WhatsApp (agregat). Isi pesan, tautan, dan nomor tidak dipublikasikan.",
            "generatedAt": datetime.now().date().isoformat(),
            "firstMessageAt": start.date().isoformat(),
            "lastMessageAt": end.date().isoformat(),
            "spanDays": span_days,
            "privacyNote": (
                "Dashboard publik ini hanya menampilkan hitungan, ranking, dan pola waktu. "
                "Nomor telepon disamarkan. Sandi rapat, tautan Zoom, dan kutipan chat tidak disertakan."
            ),
        },
        "totals": {
            "messages": len(user_msgs),
            "text": kind_counts.get("text", 0),
            "stickers": kind_counts.get("sticker", 0),
            "images": kind_counts.get("image", 0),
            "videos": kind_counts.get("video", 0),
            "documents": kind_counts.get("document", 0),
            "deleted": kind_counts.get("deleted", 0),
            "members": len(humans),
            "activeDays": len(day_counts),
            "avgPerDay": round(len(user_msgs) / span_days, 1),
            "medianPerActiveDay": sorted(day_counts.values())[len(day_counts) // 2],
            "urlsShared": sum(url_hosts.values()),
            "mentions": sum(r["mentionsReceived"] for r in humans),
            "top5SharePct": top5_share,
            "officePct": round(100 * office / len(user_msgs), 1),
            "weekendPct": round(100 * weekend / len(user_msgs), 1),
            "topicCoveragePct": round(100 * tagged_text / text_n, 1),
        },
        "mix": [
            {"kind": "Teks", "count": kind_counts.get("text", 0)},
            {"kind": "Stiker", "count": kind_counts.get("sticker", 0)},
            {"kind": "Gambar", "count": kind_counts.get("image", 0)},
            {"kind": "Dokumen", "count": kind_counts.get("document", 0)},
            {"kind": "Video", "count": kind_counts.get("video", 0)},
            {"kind": "Dihapus", "count": kind_counts.get("deleted", 0)},
        ],
        "members": member_rows,
        "topics": topics_out,
        "monthly": monthly,
        "yearly": yearly,
        "hourly": hour_labels,
        "weekdays": weekday_series,
        "heatmap": heat,
        "peakDays": [{"date": d, "count": c} for d, c in top_days],
        "topWords": top_words,
        "topEmojis": [{"emoji": e, "count": c} for e, c in emoji_counts.most_common(14)],
        "nicknames": [
            {"nick": k, "refersTo": NICKNAMES[k], "count": nick_counts[k]}
            for k, _ in sorted(nick_counts.items(), key=lambda x: -x[1])
            if nick_counts[k] >= 20
        ],
        "topMentions": [
            {"name": r["name"], "count": r["mentionsReceived"]}
            for r in sorted(humans, key=lambda r: -r["mentionsReceived"])[:10]
            if r["mentionsReceived"]
        ],
        "urlHosts": [
            {"host": h.replace("www.", ""), "count": c}
            for h, c in url_hosts.most_common(10)
        ],
        "nameHistory": name_history,
        "highlights": highlights,
        "roles": {
            "mostActive": humans[0]["name"] if humans else None,
            "mostPresent": most_days["name"] if most_days else None,
            "stickerKing": sticker_king["name"] if sticker_king else None,
            "imageKing": image_king["name"] if image_king else None,
            "mentionMagnet": mention_magnet["name"] if mention_magnet else None,
            "threadStarter": thread_starter["name"] if thread_starter else None,
            "nightOwl": night_owl["name"] if night_owl else None,
            "longWriter": long_writer["name"] if long_writer else None,
            "emojiKing": emoji_king["name"] if emoji_king else None,
        },
        "silence": silence,
        "alumni": [{"name": r["name"], "lastAt": r["lastAt"], "messages": r["messages"]} for r in alumni],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} · {len(user_msgs)} msgs · {len(humans)} members")


if __name__ == "__main__":
    main()
