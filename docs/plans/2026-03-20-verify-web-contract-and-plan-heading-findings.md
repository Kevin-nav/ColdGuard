# Verify Web Contract And Plan Heading Findings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the reported web bridge contract mismatch and markdown heading findings, then fix only the issues that still exist.

**Architecture:** Keep the TypeScript change structural-only by aligning the web module signature with the existing contract types while preserving runtime behavior. For the plan docs, promote only the top-level task headings from third-level to second-level headers.

**Tech Stack:** TypeScript, Markdown, Jest

---

## Task 1: Verify the live issues

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.web.ts`
- Modify: `docs/plans/2026-03-20-verify-notification-provider-and-runtime-repository-findings.md`
- Modify: `docs/plans/2026-03-20-multi-device-monitoring-hardening.md`

**Step 1: Inspect the web bridge signature**

Confirm `startMonitoringDeviceAsync` still omits the contract parameter and explicit return type.

**Step 2: Inspect the markdown headings**

Confirm the referenced plan files still use `### Task ...` headings that need promotion to `## Task ...`.

## Task 2: Apply the minimal fixes

**Files:**
- Modify: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.web.ts`
- Modify: `docs/plans/2026-03-20-verify-notification-provider-and-runtime-repository-findings.md`
- Modify: `docs/plans/2026-03-20-multi-device-monitoring-hardening.md`

**Step 1: Align the web module method signature**

Import `ColdGuardMonitoringServiceOptions` and add the explicit `Promise<ColdGuardMonitoringStatusMap>` return type while preserving the existing `WIFI_BRIDGE_UNAVAILABLE` error behavior.

**Step 2: Promote task headings**

Replace each `### Task ...` heading with `## Task ...` in the two referenced plan files without changing the nested step labels.

## Task 3: Verify the changes

**Files:**
- Test: `modules/coldguard-wifi-bridge/src/ColdGuardWifiBridgeModule.test.ts`

**Step 1: Run focused verification**

Run the existing web bridge Jest suite and confirm the plan files no longer contain `### Task` headings.
