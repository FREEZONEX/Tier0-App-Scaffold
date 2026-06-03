import { APP_HOME_ROUTE, getAppChromeSafeRoute } from "./app-chrome";

export interface RoleMetadata {
  label: string;
  description: string;
  defaultRoute: string;
}

export const ROLE_METADATA = {
  admin: {
    label: "管理员",
    description: "配置系统、维护权限和处理跨模块管理事项。",
    defaultRoute: APP_HOME_ROUTE,
  },
  sales: {
    label: "销售",
    description: "查看客户需求、订单进展和交付相关信息。",
    defaultRoute: APP_HOME_ROUTE,
  },
  planner: {
    label: "计划员",
    description: "维护生产计划、排程节奏和工单优先级。",
    defaultRoute: APP_HOME_ROUTE,
  },
  production_supervisor: {
    label: "生产主管",
    description: "跟踪产线执行、处理异常并协调现场资源。",
    defaultRoute: APP_HOME_ROUTE,
  },
  operator: {
    label: "操作员",
    description: "执行工位任务、报工、扫码和提交现场反馈。",
    defaultRoute: APP_HOME_ROUTE,
  },
  quality: {
    label: "质量",
    description: "处理检验、质量判定、异常评审和放行相关工作。",
    defaultRoute: APP_HOME_ROUTE,
  },
  warehouse: {
    label: "仓库",
    description: "处理收发料、库存流转、备料和仓储执行任务。",
    defaultRoute: APP_HOME_ROUTE,
  },
} as const satisfies Record<string, RoleMetadata>;

export type RoleKey = keyof typeof ROLE_METADATA;

export function getRoleMetadata(role: string): RoleMetadata {
  const metadata = ROLE_METADATA[role as RoleKey] ?? {
    label: role,
    description: "未配置角色说明。",
    defaultRoute: APP_HOME_ROUTE,
  };

  return {
    ...metadata,
    defaultRoute: getAppChromeSafeRoute(metadata.defaultRoute),
  };
}
