/* 部分已确认队伍。新增记录仅需增加一个对象，不修改页面布局。
   id: 唯一英文标识；name: 队名；number: 字符串编号；organization: 学校/机构；kind: school 或 club。
   logo: 本地队徽路径；logoPlaceholder: 是否为设计占位。
   数组顺序决定默认展示顺序。更多记录自动分页，筛选和详情自动生成。 */
window.FOUNDRYX_TEAMS = [
  { id: 'irondragon-12888', name: 'IronDragon', number: '12888', organization: 'FoundryX', kind: 'club', logo: 'assets/team-logos/irondragon-placeholder.svg', logoPlaceholder: true },
  { id: 'ironlion-12666', name: 'IronLion', number: '12666', organization: '上海惠立学校', kind: 'school', logo: 'assets/team-logos/ironlion-placeholder.svg', logoPlaceholder: true },
  { id: 'ironmane-12222', name: 'IronMane', number: '12222', organization: '上海光华剑桥', kind: 'school', logo: 'assets/team-logos/ironmane-placeholder.svg', logoPlaceholder: true },
  { id: 'ironpulse-6941', name: 'IronPulse', number: '6941', organization: '上海平和学校', kind: 'school', logo: 'assets/team-logos/ironpulse-placeholder.svg', logoPlaceholder: true },
  { id: 'ironeagle-12226', name: 'IronEagle', number: '12226', organization: '上海美国学校', kind: 'school', logo: 'assets/team-logos/ironeagle-placeholder.svg', logoPlaceholder: true },
  { id: 'alphabot-8810', name: 'Alphabot', number: '8810', organization: '苏州外国语学校', kind: 'school', logo: 'assets/team-logos/alphabot-placeholder.svg', logoPlaceholder: true }
];
