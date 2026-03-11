import * as React from 'react';

import { ColdGuardWifiBridgeViewProps } from './ColdGuardWifiBridge.types';

export function getValidatedIframeUrl(url?: string) {
  if (!url) {
    return {
      errorMessage: null,
      validatedUrl: null,
    };
  }

  try {
    const parsedUrl = new URL(url);
    const isHttpUrl = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    if (!isHttpUrl) {
      return {
        errorMessage: `Unsupported iframe URL protocol: ${parsedUrl.protocol}`,
        validatedUrl: null,
      };
    }

    return {
      errorMessage: null,
      validatedUrl: parsedUrl.toString(),
    };
  } catch {
    return {
      errorMessage: 'Invalid iframe URL provided.',
      validatedUrl: null,
    };
  }
}

export default function ColdGuardWifiBridgeView(props: ColdGuardWifiBridgeViewProps) {
  const { errorMessage, validatedUrl } = getValidatedIframeUrl(props.url);
  const iframeUrl = validatedUrl ?? 'about:blank';

  React.useEffect(() => {
    if (!errorMessage) {
      return;
    }

    props.onError?.({
      nativeEvent: {
        message: errorMessage,
        url: props.url ?? '',
      },
    });
  }, [errorMessage, props.onError, props.url]);

  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={iframeUrl}
        onLoad={() => {
          if (!validatedUrl) {
            return;
          }

          props.onLoad?.({ nativeEvent: { url: validatedUrl } });
        }}
      />
    </div>
  );
}
