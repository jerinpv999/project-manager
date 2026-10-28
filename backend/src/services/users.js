const M = require('../models');

// Deletes `user` and hands everything they owned, were assigned or wrote over to `toUser`
// (normally the admin performing the delete). Returns a per-collection count.
async function delegateAndDelete(user, toUser) {
  const from = user._id;
  const to = toUser._id;

  const swapMember = async (Model) => {
    await Model.updateMany({ members: from }, { $addToSet: { members: to } });
    const r = await Model.updateMany({ members: from }, { $pull: { members: from } });
    return r.modifiedCount;
  };
  const move = async (Model, field) => (await Model.updateMany({ [field]: from }, { [field]: to })).modifiedCount;

  const summary = {
    workspacesMembership: await swapMember(M.Workspace),
    projectsMembership: await swapMember(M.Project),
    workspacesOwned: await move(M.Workspace, 'owner'),
    tasksAssigned: await move(M.Task, 'assignee'),
    tasksReported: await move(M.Task, 'reporter'),
    featuresOwned: await move(M.Feature, 'owner'),
    featuresCreated: await move(M.Feature, 'createdBy'),
    sprints: await move(M.Sprint, 'createdBy'),
    roadmapItems: await move(M.RoadmapItem, 'createdBy'),
    docs: (await move(M.Doc, 'author')) + (await move(M.Doc, 'updatedBy')),
    diagrams: await move(M.Diagram, 'author'),
    chatMessages: (await M.Message.updateMany({ author: from }, { author: to, delegatedFrom: user.name })).modifiedCount,
  };
  await M.Task.updateMany(
    { 'comments.author': from },
    { $set: { 'comments.$[c].author': to } },
    { arrayFilters: [{ 'c.author': from }] }
  );
  await M.User.deleteOne({ _id: from });
  return summary;
}

module.exports = { delegateAndDelete };
