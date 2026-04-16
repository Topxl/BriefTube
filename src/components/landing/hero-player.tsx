"use client";

import { useRef, useState, useCallback } from "react";
import { t } from "@/locales";

const tl = t.landing.hero;

const SPEEDS = [1, 1.5, 2, 3, 4] as const;
type Speed = (typeof SPEEDS)[number];

type CardState = {
  playing: boolean;
  currentTime: number;
  duration: number;
  speed: Speed;
  expanded: boolean;
};

const R2 = "https://pub-56ac81959a8e42beae1539d791297d90.r2.dev";

// These are the actual summaries from the DB — identical to what the TTS audio reads
const DEMO_SUMMARIES = [
  `How do we explain why some organizations and leaders are able to achieve things that seem to defy all assumptions? We often wonder why Apple remains more innovative than its competitors year after year, despite being a computer company with the same access to talent, consultants, and media as everyone else. We wonder why Martin Luther King Jr. led the Civil Rights Movement when he was not the only great orator of his time, or why the Wright brothers achieved controlled, powered flight while better-funded and more educated teams failed.

The answer lies in a discovery of a specific pattern. All great, inspiring leaders and organizations—from Apple to the Wright brothers—think, act, and communicate in the exact same way, which is the complete opposite of everyone else. This concept is codified as the "Golden Circle," consisting of three layers: Why, How, and What.

Every person and organization on the planet knows "what" they do. Some know "how" they do it, often referring to it as their proprietary process or unique selling proposition. However, very few know "why" they do what they do. In this context, "why" does not mean making a profit, which is merely a result. Instead, "why" refers to a purpose, a cause, or a belief. It is the reason an organization exists and the reason anyone should care.

Most people communicate from the "outside in," moving from the clearest thing—the "what"—to the fuzziest thing. They describe what they do and how they are better, and they expect a behavior like a purchase or a vote. This approach is uninspiring. In contrast, inspired leaders communicate from the "inside out." Using Apple as an example, a typical marketing message might say they make great computers that are beautifully designed and easy to use. This is uninspiring. Apple's actual communication starts with their "why": they believe in challenging the status quo and thinking differently. They challenge the status quo by making products that are beautifully designed and user-friendly. They just happen to make great computers. Because they start with their "why," people are perfectly comfortable buying not just computers from them, but also MP3 players, phones, and DVRs.

The fundamental principle is that people don't buy what you do; they buy why you do it. This isn't just an opinion; it is grounded in biology. A cross-section of the human brain reveals three major components that correlate with the Golden Circle. The neocortex, our newest brain, corresponds with the "what" level and is responsible for rational, analytical thought and language. The middle two sections make up the limbic brain, which controls feelings like trust and loyalty, as well as all human behavior and decision-making. Crucially, the limbic brain has no capacity for language.

When we communicate from the outside in, people can understand facts and features, but this information does not drive behavior. When we communicate from the inside out, we speak directly to the part of the brain that controls decision-making. This is the source of "gut decisions." Even when presented with all the facts, a person might say something doesn't "feel" right because the part of the brain making the decision cannot verbalize the reason. If a leader does not know their "why," they cannot expect others to be loyal or to want to be a part of what they do.

This principle extends to hiring. If you hire people just because they can do a job, they will work for your money. If you hire people who believe what you believe, they will work with blood, sweat, and tears. The Wright brothers are a perfect example. They were driven by a belief that a flying machine would change the world. Their competitor, Samuel Pierpont Langley, was given $50,000 and had the best minds and market conditions, but he was motivated by wealth and fame. While the Wright brothers' team worked tirelessly through repeated crashes, Langley's team worked only for a paycheck. When the Wright brothers finally took flight in 1903, Langley simply quit because he wasn't first and didn't get the fame he sought.

Understanding the "why" is also essential for the Law of Diffusion of Innovation. To achieve mass-market success, a product or idea must reach a tipping point of 15% to 18% market penetration. The early majority will not try something until someone else has tried it first. Therefore, you must attract the innovators and early adopters—those who make intuitive decisions based on what they believe about the world. These are the people who will stand in line for six hours to buy the first iPhone or spend $40,000 on a first-generation flat-screen TV, not because the technology is perfect, but because they want to be first to prove what they believe.

Failures like TiVo illustrate what happens when you market only the "what." TiVo told consumers about their features—pausing live TV and skipping commercials—but the cynical majority didn't feel they needed it. If TiVo had marketed to those who want total control over their lives, they might have found more success.

Finally, consider Martin Luther King Jr. In 1963, 250,000 people showed up to hear him speak in Washington, D.C. There were no invitations or websites. People showed up because they believed what he believed. He didn't tell people what needed to change; he told them what he believed. He gave the "I Have a Dream" speech, not the "I Have a Plan" speech. People followed him not for him, but for themselves and their own beliefs about America.

There are leaders, and then there are those who lead. Leaders hold positions of power, but those who lead inspire us. We follow those who lead not because we have to, but because we want to. Those who start with "why" have the unique ability to inspire those around them.`,
  `In this episode of the Huberman Lab Podcast, neurobiology professor Andrew Huberman explores the science of sleep and its mirror image, wakefulness. These two states govern nearly every aspect of physical and mental health. Huberman emphasizes that sleep and wakefulness are tethered; what you do during the day determines the quality of your sleep, and how you sleep determines your focus and emotional stability while awake. The discussion focuses on actionable, science-based tools to optimize these transitions, grounded in the biological mechanisms of the brain and body.

To understand sleep, one must understand the two forces that govern it. The first is adenosine, a chemical that builds up in the nervous system the longer you remain awake. This creates "sleep hunger." Caffeine acts as an adenosine antagonist, effectively parking in the receptors that adenosine would normally occupy, thereby blocking the signal for sleepiness. However, once caffeine wears off, the accumulated adenosine binds with even greater affinity, leading to a "crash." While caffeine sensitivity varies genetically, it is generally a tool to manage wakefulness, though its timing can significantly disrupt sleep quality.

The second force is the circadian rhythm, an internal 24-hour clock located in the suprachiasmatic nucleus, just above the roof of the mouth. This clock is primarily set by light. Every cell in the body requires light information to time its metabolic processes, and the eyes are the only direct portal for this information. Specifically, a group of neurons called melanopsin ganglion cells detects light and signals the central clock. These cells are most sensitive to the quality of light found when the sun is at a "low solar angle"—specifically during sunrise and the early morning hours.

A primary recommendation for optimal sleep-wake health is to view sunlight as soon as possible after waking. This triggers a healthy pulse of cortisol from the adrenal glands, which sets a timer for the release of melatonin approximately 12 to 14 hours later. Huberman notes that viewing sunlight through a window or car windshield is significantly less effective than being outdoors, as glass filters out the specific blue and yellow wavelengths necessary to activate the circadian clock. For those in dark environments, bright artificial light or "sunlight simulators" can serve as a substitute, but natural sunlight remains the gold standard.

Conversely, the timing of light in the evening is equally critical. Viewing the sunset or low-angle light in the late afternoon provides a "circadian anchor" that helps protect the brain from the disruptive effects of light later in the night. However, Huberman warns against bright light exposure—especially overhead fluorescent lighting—between 11:00 p.m. and 4:00 a.m. During this window, the retina becomes hyper-sensitive. Light exposure at these times activates the habenula, often called the "disappointment nucleus," which suppresses dopamine and is linked to anxiety and depression. To mitigate this, evening lighting should be dim and placed low in the physical environment, such as floor lamps, to avoid activating the melanopsin cells located in the bottom half of the retina.

Huberman also introduces the concept of Non-Sleep Deep Rest (NSDR). This includes practices like Yoga Nidra, meditation, and clinical hypnosis. These tools are designed to train the nervous system to transition from the "alert" sympathetic state to the "calm" parasympathetic state. NSDR has been shown to reset dopamine levels in the striatum, an area of the brain involved in motor planning and action. These practices are particularly useful for individuals who struggle to "turn off" their minds at night. By using the body (through breathing and relaxation) to control the mind, rather than trying to force the mind into stillness, individuals can improve their ability to fall and stay asleep.

Regarding supplementation, Huberman advises caution with melatonin. Because melatonin is a hormone that can suppress the onset of puberty and is often sold in unregulated dosages, he suggests looking toward other compounds if behavioral changes are insufficient. He highlights Magnesium Threonate, which can increase GABA levels to help quiet the mind, and Theanine, which promotes relaxation. He also mentions Apigenin, a derivative of chamomile, as a potent sedative, though he notes it is also an estrogen inhibitor and should be used with awareness of its hormonal impacts.

Finally, the podcast touches on the concept of "phase advances" and "phase delays." If you want to wake up earlier, you should seek light exposure very early in the morning or even before waking (through closed eyelids). If you find yourself staying up too late, you must strictly limit evening light to prevent "delaying" your clock further. By anchoring the day with morning sunlight and evening darkness, individuals can stabilize their internal chemistry, leading to better metabolic health, improved mood, and sustained focus. Huberman concludes that while nutrition and exercise are vital, light-viewing behavior is the fundamental foundation of human health.`,
];

const DEMO_CARDS = [
  {
    channel: tl.mockupVideo1Channel,
    title: tl.mockupVideo1Title,
    thumb: "/demo-thumb-1.webp",
    src: `${R2}/audio/qp0HIF3SfI4_en.mp3`,
    fallbackDuration: 167, // 2:47
    summary: DEMO_SUMMARIES[0],
  },
  {
    channel: tl.mockupVideo2Channel,
    title: tl.mockupVideo2Title,
    thumb: "/demo-thumb-2.webp",
    src: `${R2}/audio/nm1TxQj9IsQ_en.mp3`,
    fallbackDuration: 203, // 3:23
    summary: DEMO_SUMMARIES[1],
  },
] as const;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function HeroPlayer() {
  const [cards, setCards] = useState<[CardState, CardState]>([
    {
      playing: false,
      currentTime: 0,
      duration: DEMO_CARDS[0].fallbackDuration,
      speed: 1,
      expanded: false,
    },
    {
      playing: false,
      currentTime: 0,
      duration: DEMO_CARDS[1].fallbackDuration,
      speed: 1,
      expanded: false,
    },
  ]);

  // Single stable ref holding both audio elements, never goes in hook deps
  const audiosRef = useRef<(HTMLAudioElement | null)[]>([null, null]);

  const patchCard = useCallback((index: number, patch: Partial<CardState>) => {
    setCards((prev) => {
      const next = [...prev] as [CardState, CardState];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const togglePlay = useCallback(
    (index: number) => {
      const audio = audiosRef.current[index];
      if (!audio) return;
      const other = index === 0 ? 1 : 0;
      const otherAudio = audiosRef.current[other];

      if (!audio.paused) {
        audio.pause();
        patchCard(index, { playing: false });
      } else {
        if (otherAudio && !otherAudio.paused) {
          otherAudio.pause();
          patchCard(other, { playing: false });
        }
        void audio.play();
        patchCard(index, { playing: true });
      }
    },
    [patchCard],
  );

  const toggleExpanded = useCallback((index: number) => {
    setCards((prev) => {
      const next = [...prev] as [CardState, CardState];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
  }, []);

  const cycleSpeed = useCallback(
    (index: number) => {
      const audio = audiosRef.current[index];
      const cur = cards[index].speed;
      const next = SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length];
      if (audio) audio.playbackRate = next;
      patchCard(index, { speed: next });
    },
    [cards, patchCard],
  );

  const seekTo = useCallback(
    (index: number, ratio: number) => {
      const audio = audiosRef.current[index];
      if (!audio || !cards[index].duration) return;
      const time = Math.max(0, Math.min(ratio, 1)) * cards[index].duration;
      audio.currentTime = time;
      patchCard(index, { currentTime: time });
    },
    [cards, patchCard],
  );

  return (
    <div className="mx-auto mt-16 min-h-[230px] max-w-sm">
      <div className="nm-raised rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-[0_0_16px_rgba(239,68,68,0.3)]">
            <svg
              width="22"
              height="18"
              viewBox="0 0 20 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 0L9 8L0 16V0Z" fill="white" />
              <path d="M11 0L20 8L11 16V0Z" fill="white" opacity="0.85" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">BriefTube</p>
            <p className="text-muted-foreground text-xs">{tl.mockupBotRole}</p>
          </div>
        </div>

        <div className="space-y-3">
          {DEMO_CARDS.map((demo, i) => {
            const card = cards[i];
            const progress =
              card.duration > 0 ? card.currentTime / card.duration : 0;

            return (
              <div key={i} className="nm-inset overflow-hidden rounded-xl">
                {/* Top: thumbnail bg + title + controls */}
                <div className="relative p-3">
                  <img
                    src={demo.thumb}
                    alt=""
                    width={480}
                    height={360}
                    fetchPriority={i === 0 ? "high" : "low"}
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover opacity-[0.15]"
                  />

                  <audio
                    ref={(el) => {
                      audiosRef.current[i] = el;
                    }}
                    src={demo.src}
                    preload="none"
                    onLoadedMetadata={(e) =>
                      patchCard(i, { duration: e.currentTarget.duration })
                    }
                    onTimeUpdate={(e) =>
                      patchCard(i, {
                        currentTime: e.currentTarget.currentTime,
                      })
                    }
                    onEnded={() =>
                      patchCard(i, { playing: false, currentTime: 0 })
                    }
                  />

                  <div className="relative">
                    <p className="text-muted-foreground text-xs font-medium">
                      {demo.channel}
                    </p>
                    <p className="text-sm font-medium">{demo.title}</p>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => togglePlay(i)}
                        aria-label={card.playing ? "Pause" : "Play"}
                        className="nm-raised-sm flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-red-600/[0.15] text-red-400 transition-colors hover:bg-red-600/[0.25]"
                      >
                        {card.playing ? (
                          <svg
                            className="h-3.5 w-3.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        )}
                      </button>

                      <div
                        role="progressbar"
                        aria-label={`${demo.title}: playback progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        className="relative h-1 flex-1 cursor-pointer rounded-full bg-white/[0.08]"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          seekTo(i, (e.clientX - rect.left) / rect.width);
                        }}
                      >
                        <div
                          className="h-1 w-full rounded-full bg-red-500 duration-100"
                          style={{
                            transform: `scaleX(${progress})`,
                            transformOrigin: "left",
                            transition: "transform 0.1s linear",
                          }}
                        />
                      </div>

                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {card.playing
                          ? formatTime(card.currentTime)
                          : formatTime(card.duration)}
                      </span>

                      <button
                        onClick={() => cycleSpeed(i)}
                        className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-semibold tabular-nums transition-colors"
                      >
                        x{card.speed}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom: summary on solid black bg */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(i)}
                  className={`w-full border-t border-white/[0.06] bg-white/[0.04] px-3 py-2 text-left transition-all duration-300 ${
                    card.expanded
                      ? "max-h-36 overflow-y-auto overscroll-contain"
                      : ""
                  }`}
                >
                  <p
                    className={`text-[11px] leading-relaxed text-white ${
                      card.expanded ? "whitespace-pre-line" : "line-clamp-2"
                    }`}
                  >
                    {demo.summary}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
