import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Check,
  Copy,
  DownloadSimple,
  FileText,
  GithubLogo,
  LinkedinLogo,
  X,
} from "@phosphor-icons/react";
import { person } from "@/content";
import { ArrowText } from "@/components/ui/LinkArrow";

export function ContactActions() {
  const [status, setStatus] = useState("Copy email");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cvButton = useRef<HTMLButtonElement>(null);
  const email = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLButtonElement>("[data-close-cv]")?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      cvButton.current?.focus({ preventScroll: true });
    };
  }, [open]);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(person.email);
      setStatus("Copied");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(email.current!);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      setStatus("Select and copy");
    }
    timer.current = setTimeout(() => setStatus("Copy email"), 2400);
  };
  return (
    <div id="contact" className="contact-actions">
      <button
        type="button"
        onClick={copy}
        className="email-copy"
        aria-label={
          status === "Copied"
            ? "Email address copied"
            : `Copy email address ${person.email}`
        }
      >
        <span ref={email}>{person.email}</span>
        <span className="email-copy-icon" aria-hidden="true">
          {status === "Copied" ? (
            <Check size={19} weight="bold" />
          ) : (
            <Copy size={19} />
          )}
        </span>
        <span className="sr-only" aria-live="polite">
          {status === "Copy email" ? "" : status}
        </span>
      </button>
      <div className="social-actions">
        <a href={person.linkedin} target="_blank" rel="noreferrer">
          <LinkedinLogo size={18} weight="fill" />
          <ArrowText>LinkedIn</ArrowText>
        </a>
        <a href={person.github} target="_blank" rel="noreferrer">
          <GithubLogo size={18} weight="fill" />
          <ArrowText>GitHub</ArrowText>
        </a>
        <button ref={cvButton} type="button" onClick={() => setOpen(true)}>
          <FileText size={18} />
          <ArrowText>View CV</ArrowText>
        </button>
      </div>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            aria-labelledby="cv-title"
            className="cv-dialog"
            onClose={() => setOpen(false)}
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <div className="cv-shell">
              <header className="cv-header">
                <div>
                  <h2 id="cv-title">Ashwin Baduni</h2>
                  <p>Curriculum vitae</p>
                </div>
                <div className="cv-tools">
                  <a
                    href={person.cv}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open CV in a new tab"
                  >
                    <ArrowUpRight size={18} />
                    <span>Open PDF</span>
                  </a>
                  <a href={person.cv} download aria-label="Download CV PDF">
                    <DownloadSimple size={18} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close CV preview"
                    data-close-cv
                  >
                    <X size={22} />
                  </button>
                </div>
              </header>
              <iframe
                src={`${person.cv}#view=FitH`}
                title="Ashwin Baduni curriculum vitae PDF"
              />
              <p className="cv-fallback">
                If the preview is unavailable,{" "}
                <a href={person.cv} target="_blank" rel="noreferrer">
                  open the PDF
                </a>
                .
              </p>
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
