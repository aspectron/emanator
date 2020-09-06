$(document).ready(()=>{

    class Graph {


        constructor() {
            this.OFFSET = { x: 16, y : 16 };

        }

        main() {
            let elements = [];
            let nodes = [];
            let clusters = [];
            let titles = [...$('title')];
            titles.forEach((node) => {
                let el = node.parentNode;
                let id = el.id;
                if(id.startsWith('node')) {
                    el.gv = {
                        title : node.textContent
                    }
        //            nodes.push({ el : parent, title : node.textContent });
                    nodes.push(el);
//                    elements.push(el);
                }
                if(id.startsWith('clust')) {
                    el.gv = {
                        title : node.textContent
                    }
        //            nodes.push({ el : parent, title : node.textContent });
                    //clusters.push(el);
                    nodes.push(el);
                }
            });
//console.log('clusters:',clusters);

            $('title').remove();

  
            let lock = false;
            let show = false;
            $(window).on('click',()=>{
                show = !show;
                this.hide();
            })

            nodes.forEach((node) => {
                let title = node.gv.title;
                let ref = DATA[title];

            //$(node).addClass('node');
                $(node).on('click', (e) => {
/*                    console.log(e);
                    console.log(node.gv);
                    // let title = node.gv.title;
                    // let ref = DATA[title];
                    if(ref) {
                        console.log(ref);
                    }


                    let parts = ref.relative.split(/\/|\\/);
                    let repo = parts.shift();
                    let suffix = parts.join('/');
                    //console.log(e.currentTarget.gv.title);
                    const url = `https://github.com/aspectron/${repo}/blob/master/${suffix}#L${ref.line}`;
                    window.open(url);
*/                    
                   // this.show(ref, e.originalEvent.pageX, e.originalEvent.pageY);

                    if(!show)
                        return;

                    lock = !lock;
                    e.stopPropagation();
                });

                let hide = null;
                $(node).on('mouseenter', (e) => {
                    if(lock)
                        return;
                    if(!show)
                        return;
                    // if(hide) {
                    //     clearTimeout(hide);
                    //     hide = null;
                    // }
                    console.log('enter:',node);
                    this.show(ref, e.originalEvent.pageX, e.originalEvent.pageY);
                })

                $(node).on('mouseleave', (e) => {
                    if(lock)
                        return;
                    console.log('leave:',node);
                    // hide = setTimeout(()=>{
                    //     this.hide();
                    // }, 3000);
                    this.hide();
                })

        //        console.log($("title", node).html());

            });



            let svg = document.querySelector('#wrapper svg');
            svgPanZoom(svg, {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                minZoom: 0.1
            });                
        }

        show(r, x, y) {
            const info = $('#info');
            console.log(r);

            let parts = r.relative.split(/\/|\\/);
            let repo = parts.shift();
            let suffix = parts.join('/');
            //console.log(e.currentTarget.gv.title);
            const url = `https://github.com/aspectron/${repo}/blob/master/${suffix}#L${r.line}`;


            info.html(`
            <div class='node-info'>
                <a href='${url}' target='_blank'>${r.relative} #${r.line}</a><br/>
                ${r.subject}<br/>
                ${r.callee}<br/>
            </div>
            <flow-code lang='javascript' block xstyle='display:flex;flex-direction:column;'>
                <textarea xstyle='flex:1;width:100%;xoverflow:scroll;xwhite-space:pre;'>${r.content}</textarea>
            </flow-code>
            `);
            // let width = info.width();
            // let height = info.height();

            let width = window.innerWidth/3;
            let height = window.innerHeight/3*2;
//            if(width+x > window.innerWidth)
                //x = window.innerWidth-width-2;
            // if(height+y > window.innerHeight)
                //y = window.innerHeight-height-2;
            info.css({
                right:10,
                bottom:10,
                width : `${width}px`,
                height : `${height}px`,
                // left : `${x+this.OFFSET.x}px`,
                // top : `${y+this.OFFSET.y}px`,
                display : 'flex'
            });
        }

        hide() {
            //const w = this.LUT.get(id);
            const info = $('#info');
            info.css({ display : 'none' });
        }

    }

    const graph = new Graph();
    graph.main();

/*
    clusters.forEach((cluster) => {
        const el = $("text", cluster);
        let html = el.html();
        let parts = html.split(/\/|\\/);
        let first = parts.shift();
        first = first ? `${first}` : '';
        let last = parts.pop();
        last = last ? `${last}` : '';
        el.html(`${first}/${parts.join('/')} - ${last}`);
//        console.log();

    });
*/    
/*    $(nodes).on('click', (e) => {
        console.log(e);
        console.log(e.currentTarget.gv.title);
    })
*/

});