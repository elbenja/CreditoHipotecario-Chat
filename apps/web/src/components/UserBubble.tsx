export function UserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-[82%] self-end rounded-xl bg-ch-card px-[17px] py-[14px] text-[14.5px] leading-[1.6] text-slate-100 break-words">
      {content}
    </div>
  );
}
