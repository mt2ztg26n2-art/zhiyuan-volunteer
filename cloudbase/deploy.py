#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
CloudBase 一键部署脚本
读取 .cloudbase/creds.json（gitignored），把 cloudbase/functions/zy-api 云函数
部署到指定环境（或列出环境供选择），并启用 HTTP 访问服务，输出前端可用的
云函数 URL，写入 .cloudbase/envs.json / .cloudbase/deploy-info.json。

用法：
  python deploy.py            # 部署到 creds.json 中 envId 指定的环境
  python deploy.py --list     # 仅列出环境
依赖：pip install tencentcloud-sdk-python
"""
import argparse
import base64
import io
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CREDS = os.path.join(HERE, 'creds.json')
FN_DIR = os.path.join(os.path.dirname(HERE), 'cloudbase', 'functions', 'zy-api')


def load_creds():
    if not os.path.exists(CREDS):
        print('[X] 未找到 %s' % CREDS)
        return None
    with open(CREDS, 'r', encoding='utf-8') as f:
        return json.load(f)


def make_zip(dirpath):
    """把云函数目录打成 zip（含 package.json + index.js）"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(dirpath):
            dirs[:] = [d for d in dirs if d not in ('node_modules', '.git')]
            for name in files:
                if name.endswith(('.pyc', '.md')):
                    continue
                full = os.path.join(root, name)
                arc = os.path.relpath(full, dirpath)
                z.write(full, arc)
    return buf.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true', help='仅列出环境')
    parser.add_argument('--env', help='指定环境 ID（覆盖 creds.json 中的 envId）')
    parser.add_argument('--region', default='ap-shanghai', help='地域（默认 ap-shanghai）')
    args = parser.parse_args()

    creds = load_creds()
    if not creds:
        return 1
    sid = (creds.get('secretId') or '').strip()
    skey = (creds.get('secretKey') or '').strip()
    if not sid or not skey:
        print('[X] creds.json 中 secretId / secretKey 为空')
        return 2

    from tencentcloud.common import credential
    from tencentcloud.common.exception.tencent_cloud_sdk_exception import (
        TencentCloudSDKException,
    )
    from tencentcloud.common.profile.client_profile import ClientProfile
    from tencentcloud.common.profile.http_profile import HttpProfile
    from tencentcloud.tcb.v20180608 import models, tcb_client

    cred = credential.Credential(sid, skey)
    hp = HttpProfile(); hp.endpoint = 'tcb.tencentcloudapi.com'
    cp = ClientProfile(); cp.httpProfile = hp
    client = tcb_client.TcbClient(cred, args.region, cp)

    try:
        req = models.DescribeEnvsRequest()
        resp = client.DescribeEnvs(req)
        envs = resp.EnvList or []
    except TencentCloudSDKException as e:
        print('[X] DescribeEnvs 失败: %s %s' % (e.code, e.message))
        return 4

    print('[i] 现有环境: %d 个' % len(envs))
    for e in envs:
        print('    - %s  状态=%s  别名=%s' % (e.EnvId, getattr(e, 'Status', ''), getattr(e, 'Alias', '')))

    if args.list:
        return 0

    env_id = (args.env or (creds.get('envId') or '')).strip()
    if not env_id:
        print('[X] 未指定 envId（creds.json 的 envId 或 --env），请先创建环境')
        print('    创建环境：腾讯云控制台 → 云开发 CloudBase → 新建环境（选「按量付费/免费额度」）')
        return 3

    if not any(e.EnvId == env_id for e in envs):
        print('[X] 环境 %s 不在你的账号下，请核对' % env_id)
        return 5

    print('')
    print('[i] 目标环境: %s' % env_id)
    print('[i] 云函数目录: %s' % FN_DIR)

    # 打包
    z = make_zip(FN_DIR)
    b64 = base64.b64encode(z).decode()
    print('[i] 函数包大小: %.1f KB' % (len(z) / 1024))

    # 部署云函数（HTTP 类型触发）
    try:
        req = models.CreateFunctionRequest()
        req.EnvId = env_id
        req.FunctionName = 'zy-api'
        req.Type = 'HTTP'
        req.Runtime = 'Nodejs16.13'
        req.Handler = 'index.main'
        req.InstallDependency = True
        res = models.FunctionResourceInfo()
        res.ZipFile = b64
        req.FunctionResource = res
        env_vars = [
            models.KVPair(Key='ZY_JWT_SECRET', Value='zhiyuan-volunteer-2026-cloud'),
        ]
        req.EnvVariables = env_vars
        client.CreateFunction(req)
        print('[OK] 云函数 zy-api 已创建/更新')
    except TencentCloudSDKException as e:
        if e.code in ('InvalidParameter.FunctionNameExist', 'ResourceInUse.FunctionNameExist', 'FailedOperation.FunctionAlreadyExists'):
            print('[i] 云函数已存在，尝试更新代码…')
            try:
                req2 = models.UpdateFunctionCodeRequest()
                req2.EnvId = env_id
                req2.FunctionName = 'zy-api'
                req2.Handler = 'index.main'
                res2 = models.FunctionResourceInfo()
                res2.ZipFile = b64
                req2.FunctionResource = res2
                client.UpdateFunctionCode(req2)
                print('[OK] 云函数代码已更新')
            except TencentCloudSDKException as e2:
                print('[X] 更新代码失败: %s %s' % (e2.code, e2.message))
                return 6
        else:
            print('[X] 创建云函数失败: %s %s' % (e.code, e.message))
            return 6

    # 写入部署信息
    info = {
        'envId': env_id,
        'region': args.region,
        'functionName': 'zy-api',
        'endpointTemplate': 'https://%s.service.tcloudbase.com/zy-api' % env_id,
    }
    with open(os.path.join(HERE, 'deploy-info.json'), 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    print('')
    print('[i] 部署信息已写入 .cloudbase/deploy-info.json')
    print('[i] 云函数 HTTP 访问地址（模板，以控制台实际为准）:')
    print('    ' + info['endpointTemplate'])
    print('')
    print('    启用 HTTP 访问：控制台 → 云函数 → zy-api → 触发方式/HTTP 访问 → 开启')
    print('    然后把最终 URL 填入前端 window.ZY_CB_ENDPOINT（index.html 中）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
