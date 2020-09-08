const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const acorn = require('acorn-loose');
const walk = require('acorn-walk');
const escodegen = require('escodegen');
const mkdirp = require('mkdirp');
const Module = require('../../module');

Array.prototype.first = function() { return this[0]; }
Array.prototype.last = function() { return this[this.length-1]; }



class Ref {
    constructor(...src) {
        Object.assign(this, {
            children : [], targets : [], flags : []
        }, ...src);
    }

}

class Graph extends Module {
    constructor(E, options) {
        super(E);
        this.options = Object.assign({
            fan_in : null,
            fan_out : null,
        },options || {});
        this.verbose = false;
        this.refseq = 0;
        this.args();


        this.ROOT = options.root; //path.join(__dirname,'..','apps');//,'finfr-core');
        mkdirp.sync(options.folder);
    }


	args() {
	    const args = process.argv.slice(2);

        this.flags = {};
        this.argv = []
	    args.forEach((arg) => {
            const { prop, value } = arg.match(/^--(?<prop>[\w-]+)(=(?<value>.+))?$/)?.groups || {};
            if(prop) {
                if(value === undefined)
                    this.flags[prop] = true;
                else
                    this.flags[prop] = value;
            }
            else {
                this.argv.push(arg);
            }
	    })
	}

    iterateFolder(folder, filter) {
        let files = fs.readdirSync(folder);

        let list = [];
        files.forEach((file) => {

            const target = path.join(folder, file);
            const isDirectory = fs.lstatSync(target).isDirectory();
            
            if(!filter({isDirectory,folder,file,target}))
                return;

            if(isDirectory) {
                list = list.concat(this.iterateFolder(target, filter));
            }
            else {
                list.push(target);
            }
        });

        return list;
    }

    filter({ isDirectory, folder, file, target }) {

        if(isDirectory) {
            return !/node_modules|extern|deps/.test(file);
        }
        else {
            return /\.js$/.test(file);
        }
    }

    spawn(...args) {
		return new Promise((resolve, reject) => {
			// if(this.E.flags.verbose && _.isArray(args[1]))
			// 	console.log("running:".bold,...args);

			let options = args[args.length-1] || { };
			let proc = child_process.spawn(...args);
			let done = false;

			if(options.stdout && typeof options.stdout == 'function')
				proc.stdout.on('data', options.stdout);

			proc.on('close', (code) => {
				if(!done) {
					resolve(code);
					done = true;
				}
			})

			proc.on('error', (err) => {
				if(!done) {
					done = true;
					reject(err);
				}
			})
		})
	}    

    color(r) {
        switch(r.op) {
            case 'publish': return 'blue';
            case 'subscribe': return 'green';
            case 'request': return 'purple';
            case 'fetch': return 'teal';
            default: return 'black';
        }
    }

    ignore(subject) {
        return  /subject|reply/.test(subject);
    }

    async main() {

        const { E } = this;

        const sanitize = (subject) => {
            if(!subject)
                return null;

            let sanitized = subject;
            if(this.options.sanitize?.subject)
                sanitized = this.options.sanitize.subject(subject);
            
            return sanitized
                .replace(/'|"|`/g,'')
                .replace(/\$\{|\}/g,'_');


        }


        let files = this.iterateFolder(this.ROOT, this.filter);
        // console.log(files);

//        console.log('----------------------------------------------------------------------------------');

        let dump = '';
        //const roots = new Map();

        const containers_ = { };
        let roots = [...new Set(files.map(f=>f.substring(this.ROOT.length+1).split(/\/|\\/).shift()))];
        roots.forEach((f) => {
            containers_[f] = new Ref({
                id : f,
                node : null, type : 'cluster', 
                label : f.toUpperCase(),
                relative : f,
                op : 'container',
                comment : 'ABCDEF',
            })      
        });

        // containers_['default'] = new Ref({
        //     id : f,
        //     node : null, type : 'cluster', 
        //     label : f.toUpperCase(),
        //     relative : f,
        //     comment : 'ABCDEF'
        // });
//console.log(containers);
        //     'finfr-ux' : new Ref({
        //             node : null, type : 'cluster', 
        //             label : '',
        //             relative          
        //         })      
        //     }
        // }

        // TODO - SCAN FILES AND EXTRACT ALL SUBSCRIBE MESSAGES
        let targets = files.map((file) => {

            const relative = file.substring(this.ROOT.length+1);
            const content = fs.readFileSync(file, {encoding:'utf8'});
            const comments = [];
            const tokens = [];            
            const ast = acorn.parse(content, { 
                sourceType : 'module', 
                ecmaVersion: 2020,
                ranges : true,
                onComment : comments,
                onToken : tokens
            });

            escodegen.attachComments(ast, comments, tokens);


            const T = (node) => {
                return content.substring(node.start,node.end);
            }

            const line = (node) => {
                return content.substring(0,node.start).split('\n').length;
            }

            const tpl = {
                file, relative
            };

/*
            let sid = relative.split(/\/|\\/).shift();
            let root = roots.get(sid);
            if(!root) {
                root = { 
                    type : 'cluster', children : [], targets : [], 
                    label : sid.toUpperCase()
                };
                roots.set(sid,root);
            }
*/


            const root = new Ref(tpl, { 
                node : ast.body, content, type : 'cluster', 
                label : [...new Set(relative.replace(/\.js$/,'').split(/\/|\\/))].join(' ').toUpperCase()
            });

            /*let cid = relative.split(/\/|\\/).shift();
            if(['finfr-ux','finfr-core','finfr-iface'].includes(cid) && containers_[cid]) {
                //console.log('adding', cid)
                containers_[cid].children.push(root);
                root.container = cid;
            }*/

            const refs = [root];
            const stack = [root];
            // if(relative.startsWith('finfr-ux')) {
            //     refs.unshift(container);
            // }

            const last = () => { return stack[stack.length-1]; }
            let status = { }


            const recurseCallExpression = (node,st,c) => {
                c(node.callee, st);
                node.arguments.forEach((arg) => {
                    c(arg, st);
                })
            }

            const ignore = this.ignore;

            let flags = null;

            walk.recursive(ast, status, {
                // Line(node, st, c) {
                //     console.log('Line:',JSON.stringify(node));
                // },
                // leadingComments(node, st, c) {
                //     console.log(JSON.stringify(node));
                // },

                ExpressionStatement(node, st, c) {
                    flags = [];
                    if(node.leadingComments) {
                        node.leadingComments.forEach((comment) => {
                            flags.push(comment.value.trim());
                        })
                    }
//console.log(node.expression);
                    node.expression && c(node.expression,st);
                },
/*
                ClassExpression(node, st, c) {

                    const type = 'cluster';
                    const op = 'class';
                    const label = `${node.superClass?.name||''} ${node.id?.name||''}`;
                    const route = 'default';

                    const ref = new Ref(tpl, {
                        node, content : T(node), line : line(node),
                        type, op, label,
                        route
                    });

                    refs.push(ref);
                    last().children.push(ref);

                    stack.push(ref);

                    ['id','superClass','body'].forEach(p => {
                        if(node[p])
                            c(node[p], st);
                    });

                    stack.pop(ref);
                },
*/

                CallExpression(node, st, c) {


                    if(/\.(publish|subscribe|fetch|request|createPostgresIface)\(/.test(T(node))) {
                        // console.log('callee:',T(node.callee));

                        let subject = node.arguments[0];
                        if(!subject) {
                            console.log('no arguments:', T(node));
                            recurseCallExpression(node,st,c);
                        }
                        else {

                            if(subject.type == 'ArrowFunctionExpression') {
                                recurseCallExpression(node,st,c);
                                return;
                            }

                            let callee = T(node.callee);
                            let op = callee.split('.').pop();

                            let type = op;
                            if(!/(publish|subscribe|fetch|request)$/.test(callee))
                                type = 'cluster';
                            //console.log(type, subject.type, T(subject),'callee:',callee);

                            if(ignore(T(subject))) {
                                recurseCallExpression(node,st,c);
                                return;
                            }

                            let sanitized_subject = sanitize(T(subject));
                            //console.log(subject.type, sanitized_subject,'callee:',callee);

                            let label = callee;
                            if(['Literal','TemplateLiteral','Identifier'].includes(subject.type))
                                label = sanitized_subject.replace(/>/g,'&gt;');
                            else
                                sanitized_subject = null;

                            if(label.length > 64) {
                                console.log('error label',label);
                                
                                console.log('node:',node);
                                console.log('subject:',subject);
                                console.log('callee:',callee);
                                
                                label = 'n/a';
                                
                            }

                            let route = 'default';
                            flags && flags.forEach((flag) => {
                                const [type, property, value] = flag.replace(/\s\s+/g,' ').split(' ');
                                if(type == '@nats' && property == 'route')
                                    route = value;
                            })

                            //console.log('label:',label);
                            const ref = new Ref(tpl, {
                                node, content : T(node), line : line(node),
                                type, op, callee, subject : sanitized_subject, label,
                                flags, route
                            });
                            
                            // console.log(ref.subject, flags);
                            flags = null;

                            refs.push(ref);
                            last().children.push(ref);

                            stack.push(ref);
                            recurseCallExpression(node,st,c);
                            stack.pop(ref);

                            

                            // const ref = {
                            //     node, file, content : T(node), line : line(node),
                            //     type, op, callee, subject : sanitized_subject, label,
                            //     children : [], targets : [], relative, flags, route
                            // };


                        }
                    }
                    else {
                        recurseCallExpression(node,st,c);
                    }
                }
            })


            return { file, content, ast, refs, relative, root };

        }).filter(t=>t.root.children.length);

        const refs = targets.map(t=>t.refs).flat();
        
        const containers = {}
        Object.entries(containers_).forEach(([cid,container]) => {
            if(container.children.length) {
                containers[cid] = container;
                refs.push(container);
            }
        })


        refs.forEach((ref) => {
            if(ref.children.length) {
                ref.type = 'cluster';
            }

            this.refseq++;
            ref.seq = this.refseq;
            ref.ident = `${ref.type}_x${this.refseq}`;
        })


        // used_containers.forEach((container) => {
        //     container.children.forEach((child) => {
        //         child.container = 
        //     })
        // })
        // console.log('ref0',refs[0].label);

        //refs.sort((a,b)=>{return b.targets.length - a.targets.length; })
        const pub = refs.filter(r=>r.op=='publish');
        const sub = refs.filter(r=>r.op=='subscribe');
        const req = refs.filter(r=>r.op=='request');
        const fetch = refs.filter(r=>r.op=='fetch');

        pub.forEach(p=>{            
            p.subject && sub.forEach(s=>{
                if(s.subject && p.subject == s.subject)
                    p.targets.push(s);
            })
        })

        req.forEach(r=>{
            r.subject && sub.forEach(s=>{
                if(s.subject && r.subject == s.subject)
                    r.targets.push(s);
            })
        })

        fetch.forEach(f=>{
            f.subject && sub.forEach(s=>{
                if(s.subject && f.subject == s.subject)
                    f.targets.push(s);
            })
        })

        const subject_map = new Map();
        refs.forEach(r => {
            let list = subject_map.get(r.subject) || [];
            list.push(r);
            subject_map.set(r.subject,list);
        })


// FDXI.FINFR.DXR. -> FDXI.*.DXR.>
// 


        Object.entries(this.options.fan_in||{}).forEach(([prefix, target_]) => {
            const target = subject_map.get(target_).first();
            if(!target) {
                console.log('target not found:', target_);
                return;
            }
            // console.log('src:',src_,'found:',src);
            refs.forEach(r=>{
                if((r.op=='publish'||r.op=='request')
                    && r.subject
                    && r.ident != target.ident
                    && r.subject.startsWith(prefix))
                    r.targets.push(target);
            });
        });

        Object.entries(this.options.fan_out||{}).forEach(([source_,prefix]) => {
            const source = subject_map.get(source_)?.shift?.();
            if(!source) {
                console.log('source not found:',source_);
                return;
            }
            let list = refs.filter(r=>{
                if(r.op=='subscribe'
                    && r.subject
                    && r.ident != source.ident
                    && r.subject.startsWith(prefix))
                    return true;
            });
            if(list.length) {
                //console.log('ucast links:',list);
                source.targets.push(...list);
            }
        });

//        let elements = targets.map(target => {
//            let base = target.root.container ? containers[target.root.container] : target.root;
//            return this.serialize(base);
//        }).join('\n');

        targets.forEach((target) => {
            target.links = target.refs.reduce((acc, el)=>{ 
                
                if(!el.targets)
                    console.log('NO TARGET:',el, acc);
                
                return el.targets.length+acc; 
            },0);
            //console.log('links:',target.links, target.relative);
        })
        targets.sort((a,b) => {
            return b.links-a.links;
        })

        let elements = targets.map(target => this.serialize(target.root)).join('\n');

        const links = refs.map(r => {
            return r.targets.map(t => {
                let color = 'black';
                let penwidth = 1;
                if(t.route == 'main' || r.route == 'main') {
                    penwidth = 2.5;
                    color = 'purple';
                }
                else
                if(t.route == 'outbound' || r.route == 'outbound') {
                    penwidth = 2.5;
                    color = 'purple';
                }
                
                if(t.type == 'cluster' && r.type == 'cluster') {
                    return `receptor_${r.ident} -> receptor_${t.ident} [lhead=${t.ident},ltail=${r.ident},penwidth=${penwidth},color=${color}];`;
                }
                else
                if(t.type == 'cluster') {
                    return `${r.ident} -> receptor_${t.ident} [lhead=${t.ident},penwidth=${penwidth},color=${color}];`;
                }
                else
                if(r.type == 'cluster') {
                    return `receptor_${r.ident} -> ${t.ident} [ltail=${r.ident},penwidth=${penwidth},color=${color}];`;
                }
                else
                    return `${r.ident} -> ${t.ident} [penwidth=${penwidth},color=${color}];`;
            })
        }).filter(v=>v.length).flat();
//        console.log('links:',links.length);

        const font = "Open Sans";  // Open Sans

        let dot = `

digraph "NATS Message Exchange" {
    graph [
        fontname = "${font}",
        rankdir = "LR",
        ranksep = "5.0",
        font = "${font}",
        compound = true,
//        layout = "dot"
        ];
    node [
        fontname = "${font}", 
        shape = "box" 
    ];
    edge [
        fontname = "${font}"
    ];
    subgraph cluster_root {
        
        style=invis;
        {rank=sink}

        ${elements}

        ${links.join('\n')}
    
    }    
    
}        
        `;




        fs.writeFileSync(path.join(E.TEMP,'graph.dot'), dot);

        //await this.spawn('dot',['graph.dot','-Tsvg','-o','graph.svg','-Tpng','-o','graph.png','-Timap','-o','graph.map'], { cwd : __dirname, stdio : 'inherit' });
        let code = await this.spawn('dot',['graph.dot','-Tsvg','-o','graph.svg'], { cwd : E.TEMP, stdio : 'inherit' });
        // fs.unlinkSync(path.join(__dirname,'graph.dot'));
        if(code)
            console.log("dot exited with code:",code);

        let svg = fs.readFileSync(path.join(E.TEMP,'graph.svg'), { encoding : 'utf8' });
        svg = svg.substring(svg.indexOf('<!-- Generated by graphviz'));
        fs.unlinkSync(path.join(E.TEMP,'graph.svg'));

        let nodes = {};
        refs.forEach(r=>{ 
            r = { ...r};
            if(r.targets) {
                r.targets = r.targets.map(target => target.ident);
            }
            nodes[r.ident]=r;
        });
        const nodes_json = JSON.stringify(nodes);//,null,'\t')

        const folder = this.options.folder;

        // fs.writeFileSync('data.json',JSON.stringify(nodes,null,'\t'));
        let css = fs.readFileSync(path.join(__dirname,'graph.css'), { encoding : 'utf8' });
        let jq = fs.readFileSync(path.join(__dirname,'jquery-3.5.1.min.js'), { encoding : 'utf8' });
        let pz = fs.readFileSync(path.join(__dirname,'svg-pan-zoom.min.js'), { encoding : 'utf8' });
        let gc = fs.readFileSync(path.join(__dirname,'client.js'), { encoding : 'utf8' });
        let osf = fs.readFileSync(path.join(__dirname,'open-sans.ttf'));

        let tpl = fs.readFileSync(path.join(__dirname,'graph.tpl'), { encoding : 'utf8' });
        tpl = tpl.replace(/<!-- SVG GRAPH -->/g, svg)
            .replace(/const DATA = \{\};/g,`const DATA = ${nodes_json};`);
        if(this.flags.embed) {
           tpl = tpl.replace(`<link rel="stylesheet" type="text/css" href="graph.css" >`, `\n<style>\n${css}\n</style>\n`)
                .replace(`<script src="jquery-3.5.1.min.js"></script>`,`\n<script>\n${jq}\n</script>\n`)
                .replace(`<script src="svg-pan-zoom.min.js"></script>`,`\n<script>\n${pz}\n</script>\n`)
                .replace(`<script src="graph-client.js"></script>`,`\n<script>\n${gc}\n</script>\n`)
       
        }
        else {
            fs.writeFileSync(path.join(folder,'jquery-3.5.1.min.js'),jq);
            fs.writeFileSync(path.join(folder,'svg-pan-zoom.min.js'),pz);
            fs.writeFileSync(path.join(folder,'graph.css'),css);
            fs.writeFileSync(path.join(folder,'client.js'),gc);
            fs.writeFileSync(path.join(folder,'open-sans.ttf'),osf);
        }
        fs.writeFileSync(path.join(folder,'index.html'),tpl);
    }

    serialize(r) {
        if(r.type == 'cluster') {
            const children = r.children.map(child=>this.serialize(child)).join('\n');
            //const rank = `{ rank=same }`;
//            let rankType = 'same'; // sink
            let rankType = 'same'; // sink
//console.log('=====::',r.relative);
            // if(r.relative.endsWith('finfr-app.js'))
            //     rankType = 'rightmost';
            // else 
            // if(r.relative.startsWith('finfr-ux'))
            //     rankType = 'min';
            if(r.op == 'container') {
                switch(r.relative) {
                    case 'finfr-ux': rankType = 'source'; break;
                    case 'finfr-core': rankType = 'sink'; break;
                    default: rankType = 'same'; break;
                }
            }
            else if(r.subject == 'UCAST.>')
                rankType = 'max';

            //if(/^ucast/.test(r.subject))

            let color = this.color(r);
            let fillcolor = 'transparent';
            let style = 'solid';
            let fill = false;
            if(r.relative.startsWith('finfr-ux')) {
                //color = 'red';
                // fillcolor = '#f8fbff';
                // style = 'filled';
                fill = true;
                // console.log(r.relative);
            }


//            const rank = `{ rank=same ${r.children.filter(r=>r.type!='cluster').map(r=>`${r.ident}`).join(' ')} }`;
            const rank = `{ rank=${rankType} ${r.children.filter(r=>r.type!='cluster').map(r=>`${r.ident}`).join(' ')} }`;

            // if(r.op == 'container')
            //     rank = '';
// console.log(rank);
            return `

                subgraph ${r.ident} {
                    label = "${r.label}";
                    color = "${color}";
                    fillcolor = "${fillcolor}";
                    style = ${style};
                    // penwidth = 1.5;
                    /* ${r.comment||''} */
                    ${rank}
                    receptor_${r.ident} [shape = point, style = invis];
                    ${children}
                }
            `;

        } else {
            return `${r.ident}  [label = "${r.label}", color = "${this.color(r)}", style=filled, fillcolor=white];`;
        }
    }
}

module.exports = Graph;

// (async () => {
//     const graph = new Graph();
//     graph.main();
// })();
