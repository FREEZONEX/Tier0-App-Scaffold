import { useId } from "react";
import { cn } from "@/lib/utils";

export interface ChatAvatarProps {
  size?: number;
  className?: string;
}

/**
 * ChatAvatar — circular assistant mark: green fill with a white four-pointed
 * star. Default 24px matches `text-sm`/`leading-6` and the user `Avatar` sm
 * size so the first line sits flush. Do not wrap it in another tile.
 */
export function ChatAvatar({ size = 24, className }: ChatAvatarProps) {
  const rawId = useId();
  const gradientId = `chat-avatar-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <span
      data-slot="chat-avatar"
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block size-full"
      >
        <circle cx="12" cy="12" r="12" fill={`url(#${gradientId})`} />
        <path
          transform="translate(12 12) scale(0.72) translate(-13.3955 -13.3954)"
          d="M13.3955 22.2635C13.3955 21.0368 13.1589 19.8839 12.6858 18.8049C12.2279 17.726 11.5996 16.7875 10.8015 15.9894C10.0035 15.1912 9.06481 14.5631 7.98586 14.1049C6.90691 13.6319 5.75419 13.3954 4.52734 13.3954C5.75419 13.3954 6.90691 13.1663 7.98586 12.7081C9.06481 12.2352 10.0035 11.5996 10.8015 10.8015C11.5996 10.0034 12.2279 9.06485 12.6858 7.98589C13.1589 6.90694 13.3955 5.75409 13.3955 4.52734C13.3955 5.75409 13.6244 6.90694 14.0827 7.98589C14.5555 9.06485 15.1911 10.0034 15.9891 10.8015C16.7875 11.5996 17.7258 12.2352 18.8048 12.7081C19.8837 13.1663 21.0368 13.3954 22.2633 13.3954C21.0368 13.3954 19.8837 13.6319 18.8048 14.1049C17.7258 14.5631 16.7875 15.1912 15.9891 15.9894C15.1911 16.7875 14.5555 17.726 14.0827 18.8049C13.6244 19.8839 13.3955 21.0368 13.3955 22.2635Z"
          fill="white"
        />
        <defs>
          <linearGradient
            id={gradientId}
            x1="4"
            y1="2"
            x2="20"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#cbf368" />
            <stop offset="0.55" stopColor="#92DC0B" />
            <stop offset="1" stopColor="#73B200" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
