from html import escape


def join_form(kind, title):
    def field(name, label, required=False, options=None, placeholder='', full=False, autocomplete='off'):
        identifier=f'{kind}-{name}'
        attrs=f'id="{identifier}" name="{name}"'+(' required' if required else '')
        if options:
            control=f'<select {attrs}><option value="">请选择</option>'+''.join(f'<option value="{escape(x, quote=True)}">{escape(x)}</option>' for x in options)+'</select>'
        elif name=='message':
            control=f'<textarea {attrs} rows="3" maxlength="2000" placeholder="{placeholder}"></textarea>'
        else:
            control=f'<input {attrs} type="text" maxlength="160" autocomplete="{autocomplete}" placeholder="{placeholder}">'
        return f'<label class="join-field{" full" if full else ""}" for="{identifier}"><span>{label}{" *" if required else ""}</span>{control}</label>'
    fields=field('name','你的称呼',True,autocomplete='name')+field('contact','手机 / 微信 / 邮箱',True,placeholder='留一种方便联系你的方式')
    if kind=='student':
        fields+=field('grade','当前年级',True,['8 年级及以下','9 年级','10 年级','11 年级','12 年级','其他'])+field('experience','已有基础',placeholder='零基础、编程或机器人经历')
        fields+=field('message','想了解的问题',placeholder='兴趣方向、时间安排或近期目标（选填）',full=True)
    elif kind=='partnership':
        fields+=field('organization','学校 / 企业 / 机构名称',True,autocomplete='organization')+field('stage','当前项目',True,['计划新建校队','已有 FRC 校队','已有其他机器人项目','其他'])
        fields+=field('message','希望获得的支持',placeholder='学生规模、训练安排或合作需求（选填）',full=True)
    elif kind=='team':
        fields+=field('direction','意向方向',True,['机械设计','电控与编程','教学与带队','运营与传播','其他'])+field('portfolio','作品 / 简历链接',placeholder='个人网站、网盘或 GitHub（选填）')
        fields+=field('message','介绍一下自己',placeholder='相关经历、擅长领域与可投入时间（选填）',full=True)
    else:
        fields+=field('organization','公司 / 机构名称',autocomplete='organization',placeholder='个人赞助可不填')+field('support','赞助意向',True,['资金支持','设备与材料','场地与资源','其他合作'])
        fields+=field('message','你希望怎样参与',placeholder='可提供的支持或合作想法（选填）',full=True)
    return f'''<div class="join-form-panel"><form class="join-form" data-join-form="{kind}" aria-labelledby="{kind}-form-title" action="/api/inquiries" method="post"><header class="join-form-heading"><h3 id="{kind}-form-title">{title}</h3><span>* 必填</span></header><input type="hidden" name="kind" value="{kind}"><div class="join-fields">{fields}</div><div class="join-trap" aria-hidden="true"><label>请留空<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="join-consent"><input type="checkbox" name="consent" required><span>同意 FoundryX 保存以上信息并就本次申请与我联系。</span></label><button class="join-submit" type="submit"><span>提交申请</span><span aria-hidden="true">↗</span></button><p class="join-status" role="status" aria-live="polite"></p><noscript><p>请开启 JavaScript 后提交表单。</p></noscript></form></div>'''
