import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint 10 flat config（方案 v3.1 §7.4 提交卡点）。
 *
 * 含两条项目自定义规则：
 *  ① F7：页面禁止直接 import axios —— 请求一律走 src/api 封装（唯一样例豁免：src/api/**）
 *  ② F14：禁止裸 window.open / top.location 跳老页面 —— 必须走 <LegacyLink>；
 *     打印预览等保持老行为的场景，用 eslint-disable-next-line 并注明原因
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.pnpm-store/**', '.tmp/**', 'deploy/**', 'public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    rules: {
      // 下划线开头参数/变量视为有意未使用（如 demo 占位参数）
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                '禁止页面直接 import axios：请求一律走 src/api（http/request/modules）封装（F7）',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name='open']",
          message:
            '禁止裸 window.open 跳老页面：必须走 <LegacyLink>（F14）；打印预览等保持老行为的场景用 eslint-disable 注明原因',
        },
        {
          selector: "AssignmentExpression[left.object.name='top'][left.property.name='location']",
          message: '禁止 top.location 跳老页面：必须走 <LegacyLink>（F14）',
        },
      ],
    },
  },
  {
    // api 封装层是唯一允许 import axios 的地方
    files: ['src/api/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // 关闭与 Prettier 冲突的格式规则，必须放最后
  prettierConfig,
];
