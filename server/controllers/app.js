import {
    request,
    summary,
    body,
    tags,
    middlewares,
    path,
    query,
    description
} from '../swagger';

import { APIError } from "../helper/rest";
import { responseWrapper } from "../helper/util";

const App = require('../model/app_model')
const Version = require('../model/version')
const Team = require('../model/team')

const tag = tags(['AppResource']);

//更新策略

// {
//     updateMode:{type:String,enum:['slient','normal','force']},
//     ipType:{type:String,default:'black',enum:['black','white']},
//     ipList:[String],
//     downloadCountLimit:Number
// }

var grayRelease = {
    strategy:{
    'updateMode':{type:'string'}, //更新模式  force / silent / normal/ 强制或者静默或者普通升级
    'ipType':{type:'string'}, //IP地址限制类型 {type:String,default:'black',enum:['black','white']},
    'ipList':{type:'string'}, //ip地址列表
    'downloadCountLimit':{type:'number'} //default 0 表示不现在下载次数
    },
    version:{
        versionId:{type:'string',require:true},
        versionCode:{type:'string',require:true},
        release:{type:'bool',require:true}
    }
}

var versionProfile = {
    'fileDownloadUrl':'string', //更新文件的下载地址
    'showOnDownloadPage':'boolean', //是否显示到下载页
    'changelog':'string', //修改日志
}

var appProfile = {
    'shortUrl':'string', //应用短连接
    'installWithPwd':'boolean', //应用安装是否需要密码
    'installPwd':'string', //应用安装的密码
    'autoPublish':'boolean' //新版本自动发布
}

module.exports = class AppRouter {
    @request('get','/api/apps/{teamId}')
    @summary("获取团队下App列表")
    // @query(
    //     {
    //     page:{type:'number',default:0,description:'分页页码(可选)'},
    //     size:{type:'number',default:10,description:'每页条数(可选)'}
    // })
    @path({teamId:{type:'string',description:'团队id'}})
    @tag
    static async getApps(ctx,next){
        // var page = ctx.query.page || 0
        // var size = ctx.query.size || 10
        var user = ctx.state.user.data;
        var { teamId } = ctx.validatedParams;        

        var result = await App.find(
                {'ownerId':teamId}
            )
            // .limit(size).skip(page * size)
        ctx.body = responseWrapper(result)
    }

    @request('get','/api/apps/{teamId}/{id}')
    @summary("获取某个应用详情")
    @tag
    @path({
        teamId:{type:'string'},
        id:{type:'string',description:'应用id'}
    })
    static async getAppDetail(ctx,next){
        var user = ctx.state.user.data
        var { teamId,id } = ctx.validatedParams;
        //todo: 这里其实还要判断该用户在不在team中
        //且该应用也在team中,才有权限查看
        var app = await App.findById(id)
        ctx.body = responseWrapper(app)
    }

    @request('delete','/api/apps/{teamId}/{id}')
    @summary("删除某个应用")
    @tag
    @path({
        teamId:{type:'string'},
        id:{type:'string',description:'应用id'}
    })
    static async deleteApp(ctx,next){
        var user = ctx.state.user.data
        var { teamId,id } = ctx.validatedParams;  
        var team = await Team.findOne({_id:teamId,members:{
            $elemMatch:{
                 username:user.username,
                 $or: [
                    { role: 'owner' },
                    { role: 'manager' }
                ]
            }
        }})
        var app = await App.findOne({_id:id,ownerId:team._id})
        if (!app) {
            throw new Error("应用不存在或您没有权限查询该应用")
        }
        await Version.deleteMany({appId:app.id})
        await App.deleteOne({_id:app.id})
        ctx.body = responseWrapper(true,"应用已删除")
    }

    @request('get','/api/apps/{teamId}/{id}/versions')
    @summary("获取某个应用的版本列表(分页)")
    @path({
        teamId:{type:'string'},
        id:{type:'string',description:'应用id'}
    })
    @query({
        page:{type:'number',default:0,description:'分页页码(可选)'},
        size:{type:'number',default:10,description:'每页条数(可选)'}
    })
    @tag
    static async getAppVersions(ctx,next){
        var user = ctx.state.user.data
        var { teamId,id } = ctx.validatedParams
        var { page,size } = ctx.query
        var team = await Team.find({_id:teamId,members:{
            $elemMatch:{ username:user.username}
        }})
        var app = await App.find({_id:id,ownerId:team._id})
        if (!app) {
            throw new Error("应用不存在或您没有权限查询该应用")
        }
        var versions = await Version.find({appId:id})
            .limit(size).skip(page * size)
        ctx.body = responseWrapper(versions)
    }

    @request('get','/api/apps/{teamId}/{id}/versions/{versionId}')
    @summary("获取某个应用的某个版本详情")
    @tag
    @path({
        teamId:{type:'string'},
        id:{type:'string',description:'应用id'},
        versionId:{type:'string',description:'版本id'}
    })
    static async getAppVersionDetail(ctx,next){
        //todo: 好像暂时用不上
        
        var user = ctx.state.user.data
        var { teamId,id,versionId } = ctx.validatedParams
        var team = await Team.find(
            {_id:teamId,members:{
                $elemMatch:{ username:user.username}}})
        if (!team){
            throw new Error("没有权限查看该应用")
        }
        var version = await Version.findById(versionId)
        if (!version){
            throw new Error("应用不存在")
        }
        ctx.body = responseWrapper(version)
    }

    @request('delete','/api/apps/{teamId}/{id}/versions/{versionId}')
    @summary("删除某个版本")
    @tag
    @path({
        teamId:{type:'string', description:'团队id'},
        id:{type:'string',description:'应用id'},
        versionId:{type:'string',description:'版本id'}
    })
    static async deleteAppVersion(ctx,next){
        var user = ctx.state.user.data
        var { teamId,id,versionId } = ctx.validatedParams;  
        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        var result = await Version.deleteOne({_id:versionId})
        ctx.body = responseWrapper(true,"版本已删除")
    }

    @request('post','/api/apps/{teamId}/{id}/updateMode')
    @summary("设置应用或版发布更新方式/静默/强制/普通")
    @tag
    @body({
        updateMode:{type:'string',require:true},
        versionId:{type:'string',description:"如果传入了versionId则表示设置某个版本的更新方式"}
    })
    @path({teamId:{type:'string',require:true},id:{type:'string',require:true}})
    static async setUpdateMode(ctx,next){
        var user = ctx.state.user.data;
        var body = ctx.body;
        var { teamId,id } = ctx.validatedParams;
        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        if (body.versionId) {
            //更新版本策略
            await Version.findByIdAndUpdate(versionId, {
                updateMode: body.updateMode
            })
        }else{
            await App.findByIdAndUpdate(id, {
                updateMode: body.updateMode
            })
        }
        ctx.body = responseWrapper(true, "版本发布策略设置成功")
    }

    @request('post','/api/apps/{teamId}/{id}/profile')
    @summary("更新应用设置")
    @tag
    @body(appProfile)
    @path({teamId:{type:'string',required:true},id:{type:'string',required:true}})
    static async setAppProfile(ctx,next){
        var user = ctx.state.user.data;
        var body = ctx.request.body;
        var { teamId,id } = ctx.validatedParams;

        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        if (!app) {
            throw new Error("应用不存在或您没有权限执行该操作")
        }
        await App.findByIdAndUpdate(id, body)
        ctx.body = responseWrapper(true, "应用设置已更新")
    }

    @request('post','/api/apps/{teamId}/{id}/{versionId}/profile')
    @summary("更新版本设置设置")
    @tag
    @body(versionProfile)
    @path({teamId:{type:'string',required:true},id:{type:'string',required:true},versionId:{type:'string',required:true}})
    static async setVersionProfile(ctx,next){
        var user = ctx.state.user.data;
        var body = ctx.request.body;
        var { teamId,id, versionId} = ctx.validatedParams;
        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        if (!app) {
            throw new Error("应用不存在或您没有权限执行该操作")
        }
        await Version.findByIdAndUpdate(versionId, body)
        ctx.body = responseWrapper(true, "版本设置已更新")
    }

    @request('post','/api/apps/{teamId}/{id}/grayPublish')
    @summary("灰度发布一个版本")
    @tag
    @path({teamId:{type:'string',require:true},id:{type:'string',require:true}})
    @body(grayRelease)
    static async grayReleaseAppVersion(ctx,next){
        var user = ctx.state.user.data
        var { body } = ctx.request
        var { teamId,id } = ctx.validatedParams;  

        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        if (!app) {
            throw new Error("应用不存在或您没有权限执行该操作")
        }
        var version = await Version.findById(body.version.versionId,"versionStr")

        await App.updateOne({_id:app.id},
            {
                grayReleaseVersionId:version.id,
                grayStrategy:body.strategy
        })
        ctx.body = responseWrapper(true,"版本已灰度发布")
    }

    @request('post','/api/apps/{teamId}/{id}/release')
    @summary("发布或者取消发布某个版本")
    @tag
    @path({teamId:{type:'string',require:true},id:{type:'string',require:true}})
    @body({
        versionId:{type:'string',require:true},
        versionCode:{type:'string',require:true},
        release:{type:'bool',require:true}
    })
    static async releaseVersion(ctx,next){
        var user = ctx.state.user.data
        var { body } = ctx.request
        var { teamId,id } = ctx.validatedParams;  

        var app = await appInTeamAndUserIsManager(id,teamId,user._id)
        if (!app) {
            throw new Error("应用不存在或您没有权限执行该操作")
        }
        var version = await Version.findById(body.versionId)
        if (!version) {
            throw new Error("版本不存在")
        }
        if (body.release) {
            await App.updateOne({_id:app.id},{
                releaseVersionId:version._id,
                releaseVersionCode:version.versionCode
            })
        }else{
            await App.updateOne({_id:app.id},{
                releaseVersionId:'',
                releaseVersionCode:''
            })
        }
        ctx.body = responseWrapper(true,body.release ? "版本已发布" : "版本已关闭")
    }

    @request('get','/api/app/checkupdate/{appId}/{currentVersionCode}')
    @summary("检查版本更新")
    @tag
    @path({
        appId: String,
        currentVersionCode: String
    })
    static async checkUpdate(ctx,next){
        var user = ctx.state.user.data;
        var { appId,currentVersionCode } = ctx.validatedParams;
        var app = await App.findById(id);
        if (!app) {
            throw new Error("应用不存在或您没有权限执行该操作")
        }
        var lastVersionCode = app.lastVersionCode
        if (currentVersionCode < lastVersionCode) {
            //1.拿出最新的version
            var version = Version.findOne({versionCode: lastVersionCode})
            //2.判断最新version的策略(下载次数, )

            if (version.downloadCount >= version.strategy.downloadCountLimit) {
                ctx.body = responseWrapper(false, "暂无可用的更新版本")
            } else {
                ctx.body = responseWrapper({
                    App: app,
                    version: version
                })
            }
        } else {
            ctx.body = responseWrapper(false, "您已经是最新版本了")
        }
    }

    @request('get','/api/app/{appShortUrl}')
    @summary("通过短链接获取应用最新版本")
    @tag
    @path({appShortUrl:{type:'string',require:true}})
    static async getAppByShort(ctx,next){
        var { appShortUrl } = ctx.validatedParams
        var app = await App.findOne({shortUrl:appShortUrl})
        if (!app) {
            throw new Error("应用不存在")
        }
        if (!app.releaseVersionId || app.releaseVersionId===''){
            throw new Error("当前没有已发布的版本可供下载")
        }
        var version = await Version.findById(app.releaseVersionId)
        ctx.body = responseWrapper({'app':app,'version':version})
    }

}


async function appInTeamAndUserIsManager(appId,teamId,userId) {
    var team = await Team.findOne({_id:teamId,members:{
        $elemMatch:{
             _id:userId,
             $or: [
                { role: 'owner' },
                { role: 'manager' }
            ]
        }
    },},"_id")
    if (!team) {
        throw new Error("应用不存在或您没有权限执行该操作")
    }
    var app = await App.findOne({_id:appId,ownerId:team._id})
    if (!app) {
        throw new Error("应用不存在或您没有权限执行该操作")
    }else{
        return app
    }
}

async function appAndUserInTeam(appId,teamId,userId) {
    var team = await Team.findOne({_id:teamId,members:{
        $elemMatch:{
             _id:userId
        }
    },},"_id")
    var app = await App.find({_id:appId,ownerId:team._id})
    if (!app) {
        throw new Error("应用不存在或您不在该团队中")
    }else{
        return app
    }
}

async function userInTeam(appId,teamId,userId) {
    var team = await Team.findOne({_id:teamId,members:{
        $elemMatch:{
             _id:userId
        }
    },},"_id")
    var app = await App.findOne({_id:id,ownerId:team._id})
    if (!app) {
        throw new Error("应用不存在或您不在该团队中")
    }else{
        return app
    }
}

//设置模糊查询
function modifyFilter(filter) {
    let result = {}
    for (var key in filter) {
        result[key] = {$regex: filter[key]}
    }
    return result
}



