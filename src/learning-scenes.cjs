'use strict';
// Small teaching layouts built from the original animation's drawing helpers.
module.exports = function register({ SCENES, txt, card, actor, arrow, vgrad, ease, clamp }) {
  SCENES.lesson = (ctx, E) => {
    const v = E.sc.visual || {}, items = v.items || [];
    vgrad(ctx, ['#10182d', '#202c46', '#3c4b60']);
    for (let i=0;i<16;i++) {
      ctx.fillStyle = `rgba(132,200,235,${.035 + .025*Math.sin(E.t*.8+i)})`;
      ctx.fillRect(50+i*125, 130+(i%3)*195+Math.sin(E.t+i)*18, 65, 65);
    }
    card(ctx, 300, 150, 1320, 600, {fill:'#f6f1e5', stroke:'#a7dce9', lw:3, r:28});
    txt(ctx, v.heading || E.sc.title, 960, 222, {size:48, color:'#172a44', maxW:1220});
    const layout = v.layout || 'cards';
    if (layout === 'question') {
      const show = E.u >= E.at(v.revealAtLine ?? 1);
      txt(ctx, v.question || 'どうなる？',960,367,{size:62,color:'#3a4760',maxW:1180});
      const a=show?ease((E.u-E.at(v.revealAtLine??1))/.7):0;
      card(ctx,470,452,980,146,{fill:show?'#e4f0da':'#e4e8ef',stroke:show?'#5e9163':'#a7b2c3',r:24});
      txt(ctx,show?v.answer:'？',960,525,{size:70,color:'#205c49',alpha:show?a:1,maxW:920});
    } else if (layout === 'bars') {
      const max=Math.max(1,...items.map(x=>Number(x.value)||0));
      items.forEach((it,i)=>{
        const y=322+i*105, p=ease(clamp((E.u-.4-i*.6)/1.5));
        txt(ctx,it.label,470,y+27,{size:35,color:'#293d52',maxW:220});
        const w=740*(Number(it.value)||0)/max*p;
        card(ctx,600,y,Math.max(2,w),58,{fill:['#f3c35f','#78c8bf','#9796da'][i%3],stroke:'#33435a',lw:2,r:9,shadow:false});
        txt(ctx,String(Math.round(Number(it.value)*p))+(v.unit||''),1375,y+30,{size:35,color:'#293d52',align:'left',maxW:180});
      });
    } else {
      const count=Math.max(1,items.length), gap=30, cell=(1160-gap*(count-1))/count;
      items.forEach((it,i)=>{
        const x=380+i*(cell+gap), a=ease((E.u-.2-i*.25)/.7);
        card(ctx,x,333+(1-a)*25,cell,238,{fill:['#fff0c8','#dcefeb','#e8e5fb'][i%3],stroke:'#96a9bb',r:20,alpha:a});
        txt(ctx,it.label,x+cell/2,386,{size:32,color:'#42566b',alpha:a,maxW:cell-30});
        txt(ctx,String(it.value),x+cell/2,473,{size:count>2?48:60,color:'#203b58',alpha:a,maxW:cell-30});
        if(layout==='steps'&&i<count-1) arrow(ctx,x+cell+3,465,x+cell+gap-4,465,{color:'#537a96',lw:4,head:10,alpha:a});
      });
    }
    if(v.note)txt(ctx,v.note,960,674,{size:31,color:'#49607a',maxW:1220});
    const cast=['shoga','daikon','garlic','chili','negi'];
    const partner=E.spk && E.spk!=='shoga'?E.spk:'daikon';
    const chosen=E.sc.action || (E.spk==='shoga'?'point':'idle');
    const motion=require('./character-actions.cjs').pose(chosen,E.t,280);
    actor(ctx,'shoga',156,843,280,{...motion,mute:false,shadow:true});
    actor(ctx,cast.includes(partner)?partner:'daikon',1762,843,270,{flip:true});
    ctx.fillStyle='rgba(6,13,25,.25)';ctx.fillRect(0,825,1920,30);
  };
};

