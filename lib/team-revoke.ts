// Taking a team card back from somebody who has left.
//
// Shared by the owner's Revoke (/api/team/revoke) and a department head's
// (/api/department, revoke_member), so the two cannot drift. A head's Revoke
// used to call remove_member, which refuses any claimed card, so for the one
// case it existed for it always failed.
//
// is_active: false is the important half. Revoking used to sever the member
// link and leave the card published, so an offboarded employee's name, photo,
// email and phone carried on being served at their public URL and in the vCard
// download, indefinitely, to anyone who had ever tapped their NFC card.
// Removing someone's access has to mean their details stop being handed out,
// which is both what an admin pressing this expects and what POPIA requires on
// offboarding.
//
// The card content is kept, so it can be re-issued to a replacement: inviting
// somebody sets is_active back to true. The row is not deleted, so the slug,
// QR code and printed NFC cards carry over to the next holder. It still holds
// its seat until then.
export async function revokeTeamCard(admin: any, cardId: string): Promise<{ error?: string }> {
  const { error } = await admin
    .from('team_cards')
    .update({
      user_id: null,
      claimed_at: null,
      invite_email: null,
      invite_token: null,
      invite_sent_at: null,
      is_active: false,
    } as any)
    .eq('id', cardId)
  return error ? { error: error.message } : {}
}
