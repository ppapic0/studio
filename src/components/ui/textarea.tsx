import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-xl border border-[rgba(20,41,95,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,251,255,0.99)_100%)] px-3.5 py-3 text-[14px] font-medium text-[#1a2d4a] shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_1px_3px_rgba(20,41,95,0.04)] ring-offset-background transition-[border-color,box-shadow] duration-150 placeholder:text-[#9aadbe] placeholder:font-normal resize-none focus-visible:outline-none focus-visible:border-[rgba(20,41,95,0.35)] focus-visible:shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_0_0_3px_rgba(20,41,95,0.08),0_1px_3px_rgba(20,41,95,0.05)] disabled:cursor-not-allowed disabled:opacity-45',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
