import { useMemo, useState } from "react";
import {
  ALL_SHOP, RARITY, rarityOf, getChoice, BIKES, HELMETS, JACKETS, TRAILS, HORNS,
  type GarageChoice,
} from "../game/garage";
import type { Settings } from "../game/engine";
import type { Profile } from "../game/progression";
import type { Theme } from "../game/themes";
import { mulberry32, todaySeed } from "../game/rng";
import { sfx } from "../game/audio";
import RiderPreview from "./RiderPreview";
import {
  BikeIcon, HelmetIcon, JacketIcon, FlameIcon, HornIcon, CoinIcon,
  LockIcon, CheckIcon, SparkleIcon, ShopIcon,
} from "./Icons";

type ShopKey = "bikeId" | "helmetId" | "jacketId" | "trailId" | "hornId";
type Filter = "all" | "locked" | "owned";

const TAB_ICON: Record<ShopKey, React.ReactNode> = {
  bikeId: <BikeIcon size={18} />,
  helmetId: <HelmetIcon size={18} />,
  jacketId: <JacketIcon size={18} />,
  trailId: <FlameIcon size={18} />,
  hornId: <HornIcon size={18} />,
};


interface Props {
  profile: Profile;
  settings: Settings;
  theme: Theme;
  accent: string;
  onBuy: (id: string, price: number, key: ShopKey) => void;
  onEquip: (key: ShopKey, id: string) => void;
}

export default function Shop({ profile, settings, theme, accent, onBuy, onEquip }: Props) {
  const [tab, setTab] = useState<ShopKey>("bikeId");
  const [filter, setFilter] = useState<Filter>("all");
  const [focus, setFocus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<GarageChoice<string> | null>(null);

  const purchasable = useMemo(
    () => ALL_SHOP.flatMap((g) => g.items.filter((i) => i.price > 0).map((i) => ({ key: g.key as ShopKey, item: i }))),
    []
  );
  const ownedCount = purchasable.filter((p) => profile.owned.includes(p.item.id)).length;

  // one rotating discounted item per day, stable for everyone
  // daily rotation: three discounted items chosen from the date seed (same for everyone today)
  const deals = useMemo(() => {
    const r = mulberry32(todaySeed() ^ 0x5eed);
    const pool = [...purchasable];
    const picked: typeof purchasable = [];
    while (pool.length && picked.length < 3) picked.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return picked;
  }, [purchasable]);
  const offFor = (id: string) => {
    const i = deals.findIndex((d) => d.item.id === id);
    return i < 0 ? 0 : [0.3, 0.2, 0.15][i];
  };
  const deal = deals.find((d) => !profile.owned.includes(d.item.id)) ?? null;

  const priceOf = (item: GarageChoice<string>) => Math.round(item.price * (1 - offFor(item.id)));

  const group = ALL_SHOP.find((g) => g.key === tab)!;
  const items = group.items.filter((i) => {
    if (filter === "locked") return !profile.owned.includes(i.id);
    if (filter === "owned") return profile.owned.includes(i.id);
    return true;
  });

  const lockedInTab = group.items.filter((i) => !profile.owned.includes(i.id));
  const bundlePrice = Math.round(lockedInTab.reduce((a, i) => a + priceOf(i), 0) * 0.85);

  // preview reflects whatever you are inspecting
  const preview = {
    bikeId: (tab === "bikeId" && focus ? focus : settings.bikeId) as Settings["bikeId"],
    helmetId: (tab === "helmetId" && focus ? focus : settings.helmetId) as Settings["helmetId"],
    jacketId: (tab === "jacketId" && focus ? focus : settings.jacketId) as Settings["jacketId"],
    trailId: (tab === "trailId" && focus ? focus : settings.trailId) as Settings["trailId"],
  };

  const focusItem = focus ? group.items.find((i) => i.id === focus) : null;
  const focusOwned = focusItem ? profile.owned.includes(focusItem.id) : false;
  const equippedId = (settings as unknown as Record<string, string>)[tab];

  const inspect = (item: GarageChoice<string>) => {
    setFocus(item.id);
    sfx.unlock();
    if (tab === "hornId" && profile.owned.includes(item.id)) sfx.horn(item.id as never);
    else sfx.ui();
  };

  const buyBundle = () => {
    if (profile.wallet < bundlePrice || !lockedInTab.length) return;
    // charge the discounted total on the first item, then grant the rest free
    let first = true;
    for (const i of lockedInTab) {
      onBuy(i.id, first ? bundlePrice : 0, tab);
      first = false;
    }
    sfx.powerup();
  };

  const nameFor = (key: ShopKey, id: string) => {
    const table = { bikeId: BIKES, helmetId: HELMETS, jacketId: JACKETS, trailId: TRAILS, hornId: HORNS }[key];
    return getChoice(table as GarageChoice<string>[], id).name;
  };

  return (
    <div>
      {/* wallet + collection progress */}
      <div className="mb-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] font-bold tracking-widest text-yellow-200">WALLET</span>
          <span className="flex items-center gap-1.5 font-display text-xl font-black text-yellow-300">
            <CoinIcon size={20} /> {profile.wallet.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all"
            style={{ width: `${(ownedCount / purchasable.length) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-yellow-100/60">
          <span>{ownedCount}/{purchasable.length} unlocked</span>
          <span>Coins are earned every run</span>
        </div>
      </div>

      {/* daily deal */}
      {deal && (
        <button onClick={() => { setTab(deal.key); setFocus(deal.item.id); sfx.ui(); }}
          className="btn-neon mb-3 flex w-full items-center gap-3 rounded-2xl border border-fuchsia-400/40 bg-fuchsia-500/15 p-3 text-left">
          <span className="text-fuchsia-300"><SparkleIcon size={24} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[9px] font-bold tracking-[0.2em] text-fuchsia-200">
              DAILY ROTATION · {deals.filter((d) => !profile.owned.includes(d.item.id)).length} ON SALE · UP TO 30% OFF
            </span>
            <span className="block truncate font-display text-xs font-black text-white">
              {nameFor(deal.key, deal.item.id)}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-[9px] text-white/40 line-through">{deal.item.price}</span>
            <span className="flex items-center gap-1 font-display text-sm font-black text-fuchsia-200">
              <CoinIcon size={13} /> {priceOf(deal.item)}
            </span>
          </span>
        </button>
      )}

      {/* live preview */}
      <RiderPreview {...preview} theme={theme} height={168} />
      {focusItem && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/35 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1.5 py-0.5 font-display text-[8px] font-black tracking-wider"
                  style={{ background: RARITY[rarityOf(focusItem.price)].glow, color: RARITY[rarityOf(focusItem.price)].color }}>
                  {RARITY[rarityOf(focusItem.price)].label}
                </span>
                <span className="truncate font-display text-xs font-black text-white">{focusItem.name}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-white/50">{focusItem.detail}</div>
            </div>
            {focusOwned ? (
              <button onClick={() => { onEquip(tab, focusItem.id); sfx.ui(); }}
                disabled={equippedId === focusItem.id}
                className="btn-neon shrink-0 rounded-xl px-4 py-2 font-display text-[10px] font-black tracking-widest"
                style={equippedId === focusItem.id
                  ? { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                  : { background: accent, color: "#000" }}>
                {equippedId === focusItem.id ? "EQUIPPED" : "EQUIP"}
              </button>
            ) : (
              <button onClick={() => setConfirm(focusItem)}
                disabled={profile.wallet < priceOf(focusItem)}
                className={`btn-neon flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 font-display text-[10px] font-black tracking-widest ${profile.wallet >= priceOf(focusItem) ? "text-black" : "bg-white/10 text-white/40"}`}
                style={profile.wallet >= priceOf(focusItem) ? { background: accent } : {}}>
                <CoinIcon size={13} /> {priceOf(focusItem)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* category tabs */}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {ALL_SHOP.map((g) => {
          const k = g.key as ShopKey;
          const active = k === tab;
          const left = g.items.filter((i) => !profile.owned.includes(i.id)).length;
          return (
            <button key={k} onClick={() => { setTab(k); setFocus(null); sfx.ui(); }}
              className={`btn-neon relative flex flex-col items-center gap-1 rounded-xl border py-2 ${active ? "bg-white/10 text-white" : "border-white/10 bg-black/30 text-white/55"}`}
              style={active ? { borderColor: accent, boxShadow: `0 0 12px ${accent}44` } : {}}>
              {TAB_ICON[k]}
              <span className="font-display text-[8px] font-bold">{g.label}</span>
              {left > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-display text-[8px] font-black text-black"
                  style={{ background: accent }}>{left}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="mt-2 flex gap-1.5">
        {(["all", "locked", "owned"] as Filter[]).map((f) => (
          <button key={f} onClick={() => { setFilter(f); sfx.ui(); }}
            className={`btn-neon flex-1 rounded-lg border py-1.5 font-display text-[9px] font-bold tracking-widest ${filter === f ? "border-white/30 bg-white/15 text-white" : "border-white/10 bg-black/25 text-white/45"}`}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* item grid */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map((it) => {
          const have = profile.owned.includes(it.id);
          const price = priceOf(it);
          const afford = profile.wallet >= price;
          const rar = RARITY[rarityOf(it.price)];
          const isFocus = focus === it.id;
          const isEquipped = equippedId === it.id;
          const onDeal = offFor(it.id) > 0;
          return (
            <button key={it.id} onClick={() => inspect(it)}
              className={`btn-neon relative overflow-hidden rounded-xl border p-2 text-left ${isFocus ? "bg-white/10" : "border-white/10 bg-black/30"} ${have ? "" : "opacity-90"}`}
              style={isFocus ? { borderColor: rar.color, boxShadow: `0 0 14px ${rar.glow}` } : { borderColor: `${rar.color}33` }}>
              {onDeal && !have && (
                <span className="absolute right-0 top-0 rounded-bl-lg bg-fuchsia-500 px-1.5 py-0.5 font-display text-[7px] font-black text-white">-{Math.round(offFor(it.id) * 100)}%</span>
              )}
              <span className="mb-1.5 block h-8 w-full rounded-lg"
                style={{ background: `linear-gradient(135deg, ${it.colors[0]}, ${it.colors[1]})` }} />
              <span className="mb-0.5 block font-display text-[7px] font-black tracking-wider" style={{ color: rar.color }}>
                {rar.label}
              </span>
              <span className="block truncate font-display text-[10px] font-bold text-white">{it.name}</span>
              <span className="mb-1.5 block truncate text-[9px] text-white/45">{it.detail}</span>
              {have ? (
                <span className={`flex items-center justify-center gap-1 rounded-lg py-1 font-display text-[9px] font-bold ${isEquipped ? "text-black" : "bg-white/10 text-white/80"}`}
                  style={isEquipped ? { background: accent } : {}}>
                  {isEquipped ? <><CheckIcon size={10} /> ON</> : "OWNED"}
                </span>
              ) : (
                <span className={`flex items-center justify-center gap-1 rounded-lg py-1 font-display text-[9px] font-bold ${afford ? "bg-white/15 text-white" : "bg-black/40 text-white/35"}`}>
                  {afford ? <CoinIcon size={10} /> : <LockIcon size={10} />} {price}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* bundle */}
      {lockedInTab.length > 1 && (
        <button onClick={buyBundle} disabled={profile.wallet < bundlePrice}
          className={`btn-neon mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 ${profile.wallet >= bundlePrice ? "border-emerald-400/40 bg-emerald-500/15" : "border-white/10 bg-black/30 opacity-60"}`}>
          <span className="flex items-center gap-2">
            <ShopIcon size={18} />
            <span className="text-left">
              <span className="block font-display text-[10px] font-bold tracking-widest text-white">
                UNLOCK ALL {group.label}
              </span>
              <span className="block text-[9px] text-white/50">{lockedInTab.length} items · save 15%</span>
            </span>
          </span>
          <span className="flex items-center gap-1 font-display text-sm font-black text-emerald-200">
            <CoinIcon size={14} /> {bundlePrice}
          </span>
        </button>
      )}

      {/* purchase confirmation */}
      {confirm && (
        <div className="fade-in absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
          onClick={() => setConfirm(null)}>
          <div className="pop-in w-full max-w-[16rem] rounded-2xl border border-white/15 bg-[#140a2e] p-4 text-center"
            onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto mb-2 block h-10 w-full rounded-lg"
              style={{ background: `linear-gradient(135deg, ${confirm.colors[0]}, ${confirm.colors[1]})` }} />
            <div className="font-display text-sm font-black text-white">{confirm.name}</div>
            <div className="mb-3 text-[10px] text-white/50">{confirm.detail}</div>
            <div className="mb-3 flex items-center justify-center gap-1.5 font-display text-lg font-black text-yellow-300">
              <CoinIcon size={18} /> {priceOf(confirm)}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)}
                className="btn-neon flex-1 rounded-xl bg-white/10 py-2 font-display text-[10px] font-bold text-white">
                CANCEL
              </button>
              <button onClick={() => { onBuy(confirm.id, priceOf(confirm), tab); setConfirm(null); }}
                className="btn-neon flex-1 rounded-xl py-2 font-display text-[10px] font-black text-black"
                style={{ background: accent }}>
                BUY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
