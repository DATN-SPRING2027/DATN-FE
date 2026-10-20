"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CloseIcon, DocsIcon } from "@/icons";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import ReferenceImage from "./ReferenceImage";
import styles from "./scotch.module.css";

const stories = [
  {
    avatar: "notes-icon.svg",
    cover: "developer-team.jpg",
    video: "team-collaboration",
    poster: "team-collaboration-poster.jpg",
  },
  {
    avatar: "review-icon.svg",
    cover: "code-review-team.jpg",
    video: "developer-coding",
    poster: "developer-coding-poster.jpg",
  },
  {
    avatar: "team-icon.svg",
    cover: "software-discussion.jpg",
    video: "workspace-timelapse",
    poster: "workspace-timelapse-poster.jpg",
  },
];
export default function TeamStories() {
  const t = useTranslations("landingScotch");
  const [active, setActive] = useState(0);
  const { isOpen, openModal, closeModal } = useModal();
  const closeButton = useRef<HTMLButtonElement>(null);
  const overviewVideo = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = stories[active];
  const n = active + 1;
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, [isOpen]);
  return (
    <section
      id="team-stories"
      className={`${styles.container} ${styles.stories}`}
      aria-labelledby="stories-title"
    >
      <div className={styles.storiesHeading}>
        <p className={styles.label}>
          <DocsIcon aria-hidden="true" />
          {t("storyLabel")}
        </p>
        <div>
          <h2 id="stories-title">{t("storyTitle")}</h2>
          <div className={styles.carouselControls}>
            <button
              type="button"
              aria-label={t("previousStory")}
              onClick={() =>
                setActive((i) => (i + stories.length - 1) % stories.length)
              }
            >
              <ArrowRightIcon
                className={styles.previousArrow}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              aria-label={t("nextStory")}
              onClick={() => setActive((i) => (i + 1) % stories.length)}
            >
              <ArrowRightIcon aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.storyGrid}>
        <article
          className={styles.storyCard}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.person}>
            <ReferenceImage file={current.avatar} width={40} height={38} />
            <div>
              <strong>{t(`story${n}Name`)}</strong>
              <p>{t(`story${n}Role`)}</p>
            </div>
          </div>
          <blockquote>{t(`story${n}Quote`)}</blockquote>
          <dl>
            <div>
              <dt>{t("context")}</dt>
              <dd>{t(`story${n}Context`)}</dd>
            </div>
            <div>
              <dt>{t("stage")}</dt>
              <dd>{t(`story${n}Stage`)}</dd>
            </div>
          </dl>
        </article>
        <div className={styles.storyVisual}>
          <ReferenceImage
            file={current.cover}
            alt={t(`storyPhoto${n}`)}
            width={1200}
            height={800}
            sizes="(max-width: 849px) 94vw, 65vw"
          />
          <button
            ref={trigger}
            type="button"
            aria-label={t("watch")}
            onClick={openModal}
          >
            <span aria-hidden="true">▷</span>
          </button>
        </div>
      </div>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        showCloseButton={false}
        className="mx-4 max-w-5xl overflow-hidden bg-black dark:bg-black"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overview-title"
          tabIndex={-1}
          className={styles.videoDialog}
        >
          <span
            className="sr-only"
            tabIndex={0}
            onFocus={() => overviewVideo.current?.focus()}
          />
          <div>
            <h2 id="overview-title">{t("videoTitle")}</h2>
            <button
              type="button"
              ref={closeButton}
              aria-label={t("closeVideo")}
              onClick={closeModal}
            >
              <CloseIcon aria-hidden="true" />
            </button>
          </div>
          <video
            key={current.video}
            ref={overviewVideo}
            controls
            autoPlay
            playsInline
            tabIndex={0}
            aria-label={t("videoAlt")}
            poster={`/videos/landing/${current.poster}`}
          >
            <source
              src={`/videos/landing/${current.video}.mp4`}
              type="video/mp4"
            />
          </video>
          <p>{t("footageLabel")}</p>
          <span
            className="sr-only"
            tabIndex={0}
            onFocus={() => closeButton.current?.focus()}
          />
        </div>
      </Modal>
    </section>
  );
}
