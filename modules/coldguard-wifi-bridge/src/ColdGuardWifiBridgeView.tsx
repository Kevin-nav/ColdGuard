import { requireNativeView } from 'expo';
import * as React from 'react';

import { ColdGuardWifiBridgeViewProps } from './ColdGuardWifiBridge.types';

const NativeView: React.ComponentType<ColdGuardWifiBridgeViewProps> =
  requireNativeView('ColdGuardWifiBridge');

export default function ColdGuardWifiBridgeView(props: ColdGuardWifiBridgeViewProps) {
  return <NativeView {...props} />;
}
