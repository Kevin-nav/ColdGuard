import * as React from 'react';

import { ColdGuardWifiBridgeViewProps } from './ColdGuardWifiBridge.types';

export default function ColdGuardWifiBridgeView(props: ColdGuardWifiBridgeViewProps) {
  const url = props.url ?? "about:blank";

  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={url}
        onLoad={() => props.onLoad?.({ nativeEvent: { url } })}
      />
    </div>
  );
}
