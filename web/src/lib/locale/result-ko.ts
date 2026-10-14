const completedReason = "模型正常结束了本轮，但没有留下文字总结；事实和资产以本轮工具调用记录为准";
const modelErrorReason =
  "模型或 API 调用失败（网络、鉴权、限流、供应商 5xx 等），重试用尽后意图标记为 blocked——传输层故障导致这条意图基本没真正探成；查其执行过程（get_worker_trace）后再决定重派或换法";

const reportReplacements: [string, string][] = [
  ["**终态**", "**최종 상태**"],
  ["**中断原因**", "**중단 사유**"],
  ["**底层错误**", "**하위 오류**"],
  ["**已执行**", "**실행 횟수**"],
  ["轮模型回合", "회 모델 실행"],
  ["**本次运行耗时**", "**이번 실행 시간**"],
  ["**累计 token**", "**누적 토큰**"],
  ["**中断前最后一个工具**", "**중단 전 마지막 도구**"],
  ["**工具调用**", "**도구 호출**"],
  ["本次运行还没有发出工具调用就结束了", "이번 실행은 도구를 호출하기 전에 종료되었습니다."],
  ["运行在模型输出流式生成阶段被取消", "모델 응답을 스트리밍하던 중 실행이 취소되었습니다."],
  ["运行中的工具调用被取消", "실행 중이던 도구 호출이 취소되었습니다."],
  [
    "用户通过任务控制接口（POST /api/tasks/{id}/control，action=pause）暂停了任务。本次 Planner/Worker 运行被主动取消；运行中的意图会退回 frontier(open)，恢复任务后重新领取并从头执行",
    "사용자가 작업 제어 API(POST /api/tasks/{id}/control, action=pause)로 작업을 일시 중지했습니다. Planner/Worker 실행은 취소되었으며, 실행 중이던 의도는 frontier(open) 상태로 돌아갑니다. 작업을 재개하면 다시 할당되어 처음부터 실행됩니다.",
  ],
  [
    completedReason,
    "모델이 정상적으로 실행을 마쳤지만 텍스트 요약을 남기지 않았습니다. 사실과 자산은 이번 실행의 도구 호출 기록을 기준으로 확인하세요.",
  ],
  [
    modelErrorReason,
    "모델 또는 API 호출에 실패했습니다(네트워크, 인증, 요청 제한, 공급자 5xx 등). 재시도를 모두 사용한 뒤 의도가 blocked 상태가 되었습니다. 전송 계층 오류로 실제 탐색이 거의 진행되지 않았습니다. 실행 추적(get_worker_trace)을 확인한 뒤 재할당하거나 다른 방법을 선택하세요.",
  ],
  ["（无文字总结，终态 completed：", "(텍스트 요약 없음, 최종 상태 completed: "],
  ["（无文字总结，终态 model_error：", "(텍스트 요약 없음, 최종 상태 model_error: "],
];

/** Translate only ARTEX's known fixed terminal-report boilerplate; leave evidence and tool output intact. */
export function localizeTerminalResult(text: string): string {
  if (!/[\u3400-\u9fff]/.test(text)) return text;

  let localized = text.replace(
    /（运行被中断：用户暂停了任务；停在模型输出阶段，已运行 (\d+) 轮 \/ ([^，）]+)，未完成）/g,
    "(사용자가 작업을 일시 중지해 실행이 중단되었습니다. 모델 출력 단계에서 $1회 실행했고, 경과 시간은 $2이며 완료되지 않았습니다.)",
  );

  localized = localized
    .replace(
      /（无文字总结，终态 completed：[^\n]*/g,
      "(텍스트 요약 없음, 최종 상태 completed: 모델이 정상적으로 실행을 마쳤지만 텍스트 요약을 남기지 않았습니다. 사실과 자산은 이번 실행의 도구 호출 기록을 기준으로 확인하세요.)",
    )
    .replace(
      /（无文字总结，终态 model_error：[^\n]*/g,
      "(텍스트 요약 없음, 최종 상태 model_error: 모델 또는 API 호출 오류로 재시도가 모두 소진되어 의도가 blocked 상태입니다. 전송 계층 오류로 실제 탐색은 거의 진행되지 않았습니다. 실행 추적을 확인한 뒤 재할당하거나 다른 방법을 선택하세요.)",
    );

  localized = localized
    .replace("intent_id 不属于本任务或其直接关联任务", "intent_id가 이 작업 또는 직접 연결된 작업에 속하지 않습니다.")
    .replace(
      /parent_id (\d+) 是 "(intent|digest)" 节点，不能作为意图锚点：意图只能锚在已确认的【事实\(fact\)\/发现\(finding\)】上，不能挂在意图\/目标\/提示上；顶层全新方向请留空 parent_ids/g,
      "parent_id $1은 '$2' 노드이므로 의도 기준점으로 사용할 수 없습니다. 의도는 확인된 사실(fact) 또는 발견(finding)에만 연결할 수 있으며, 의도·목표·힌트에는 연결할 수 없습니다. 최상위의 새 방향은 parent_ids를 비워 두세요.",
    );

  // Restrict boilerplate conversion to the backend's structured terminal report.
  if (
    localized.includes("**终态**") ||
    localized.includes("**底层错误**") ||
    localized.includes("（无文字总结，终态")
  ) {
    for (const [source, target] of reportReplacements) localized = localized.split(source).join(target);
    localized = localized.replace(/（无文字总结，/g, "(텍스트 요약 없음, ");
  }
  return localized;
}
