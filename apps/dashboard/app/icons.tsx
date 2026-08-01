import type { SVGProps } from "react";
import type { Channel, TacEvent } from "@tac-starter/shared";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 21l1.9-5.6A9 9 0 1 1 8.4 20L3 21z" />
      <path d="M9 10c.5 1.5 1.5 2.5 3 3l1.5-1.2c.4-.3.9-.3 1.3-.1l2 1c.4.2.5.7.3 1-1 2-3 2.6-5 1.6C10 14.5 8 12.5 7.6 10.4c-.4-2 .3-3.7 2.2-4.5.4-.2.9 0 1 .4L11.6 8c.2.4.1.9-.2 1.3L10 10z" />
    </svg>
  );
}

export function SMSIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-4 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-4l-5 4v-4H7a3 3 0 0 1-3-3V6z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  );
}

export function VoiceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 4l3-1 3 5-2 2a12 12 0 0 0 5 5l2-2 5 3-1 3a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function ChannelIcon({ channel, ...props }: { channel: Channel } & IconProps) {
  switch (channel) {
    case "whatsapp":
      return <WhatsAppIcon {...props} />;
    case "sms":
      return <SMSIcon {...props} />;
    case "chat":
      return <ChatIcon {...props} />;
    case "voice":
      return <VoiceIcon {...props} />;
  }
}

// Event-type icons

export function InboxIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7l-3 6a2 2 0 0 1-2 1H9a2 2 0 0 1-2-1l-3-6z" />
    </svg>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3h3V4H9z" />
      <path d="M15 4h-3v18h3a3 3 0 0 0 3-3v-1a3 3 0 0 0 2-3 3 3 0 0 0-2-3V7a3 3 0 0 0-3-3z" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 5.5a4 4 0 0 1 5 5l-2-1-2 2 1 2a4 4 0 0 1-5-5l1 2 2-2-2-2 2 1z" />
      <path d="M6.5 14.5l7 7a2 2 0 0 0 3-3l-7-7-3 3z" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11L20 4l-7 17-2-8-8-2z" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
    </svg>
  );
}

export function EventIcon({ type, ...props }: { type: TacEvent["type"] } & IconProps) {
  switch (type) {
    case "message.received":
      return <InboxIcon {...props} />;
    case "memory.recalled":
      return <BrainIcon {...props} />;
    case "llm.completed":
      return <SparkleIcon {...props} />;
    case "tool.called":
      return <WrenchIcon {...props} />;
    case "message.sent":
      return <SendIcon {...props} />;
    case "rule.fired":
      return <BoltIcon {...props} />;
  }
}

// UI chrome

export function SunIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
