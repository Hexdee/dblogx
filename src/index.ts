// cannister code goes here
import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal, nat} from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Post = Record<{
    id: string;
    author: Principal;
    title: string;
    content: string;
    image: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
    comments: Vec<Comment>;
    likes: nat;
    liked: Vec<Principal>;
    disliked: Vec<Principal>; //array to hold principal IDs for those that disliked the post
    dislikes:nat; // store all the number of dislikes on the post
}>

type PostPayload = Record<{
    title: string;
    content: string;
    image: string;
}>

type Comment = Record<{
    author: Principal;
    content: string;
    createdAt: nat64;
}>

type Statistics = Record<{
    totalPosts : number;
    uniqueAuthors : number;
    mostLikedPost : Post;
    mostDisLikedPost: Post;
}>


//stable map to store posts
const postStorage = new StableBTreeMap<string, Post>(0, 44, 1024);

//retireve all the posts stored in the canister
$query;
export function getPosts(): Result<Vec<Post>, string> {
    return Result.Ok(postStorage.values());
}


//retrieve a post by its ID
$query;
export function getPost(id: string): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => Result.Ok<Post, string>(post),
        None: () => Result.Err<Post, string>(`a post with id=${id} not found`)
    });
}

//create and save a post in the canister
$update;
export function post(payload: PostPayload): Result<Post, string> {
    const post: Post = { id: uuidv4(), createdAt: ic.time(), updatedAt: Opt.None, author: ic.caller(), comments: [], likes: 0n, liked: [], disliked: [], dislikes: 0n, ...payload };
    postStorage.insert(post.id, post);
    return Result.Ok(post);
}


//update a post by its id
$update;
export function updatePost(id: string, payload: PostPayload): Result<Post, string> {
    return match(postStorage.get(id), {
        Some: (post) => {
            if (post.author != ic.caller()) {
                return Result.Err<Post, string>(`only post authors can update a post`)
            }
            const updatedPost: Post = {...post, ...payload, updatedAt: Opt.Some(ic.time())};
            postStorage.insert(post.id, updatedPost);
            return Result.Ok<Post, string>(updatedPost);
        },
        None: () => Result.Err<Post, string>(`couldn't update a post with id=${id}. post not found`)
    });
}

//delete a post using its id
$update;
export function deletePost(id: string): Result<Post, string> {
    return match(postStorage.remove(id), {
        Some: (deletedPost) => {
            if (deletedPost.author != ic.caller()) {
                return Result.Err<Post, string>(`only post authors can delete a post`)
            }
            return Result.Ok<Post, string>(deletedPost)
        },
        None: () => Result.Err<Post, string>(`couldn't delete a post with id=${id}. message not found.`)
    });
}

//comment on a post
$update;
export function comment(postId: string, content: string): Result<Comment, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const comment: Comment = {content, author: ic.caller(), createdAt: ic.time()};
            post.comments.push(comment);
            postStorage.insert(post.id, post);
            return Result.Ok<Comment, string>(comment);
        },
        None: () => Result.Err<Post, string>(`couldn't comment on a post with id=${postId}. post not found`)
    });
}


//like a post

$update;
export function like(postId: string): Result<nat, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const hasLiked = post.liked.findIndex(caller => caller.toString() == ic.caller().toString());
            const hasDisLiked = post.disliked.findIndex(caller => caller.toString() == ic.caller().toString());


            if(hasLiked ==-1 && hasDisLiked == -1){ ///if user has neither liked nor disliked, like the post
                post.likes = post.likes + 1n;
                post.liked.push(ic.caller());
                postStorage.insert(post.id, post);
                return Result.Ok<nat, string>(post.likes);

            } else if(hasLiked !=-1 && hasDisLiked == -1){ //if the user has liked but not disked, they can like again
                return Result.Err<nat, string>(`you can't like a post twice`);

            }else if(hasLiked == -1 && hasDisLiked != -1){ ///if user had disliked before, remove the dislike and add a like
                post.likes = post.likes + 1n;
                post.dislikes = post.dislikes- 1n;
                post.liked.push(ic.caller());
                post.disliked.splice(hasDisLiked, 1);
                postStorage.insert(post.id, post);
                return Result.Ok<nat, string>(post.likes);
                
            } else{
                return Result.Err<nat, string>(`Something went wrong.`);

            }
        },
        None: () => Result.Err<nat, string>(`couldn't like a post with id=${postId}. post not found`)
    })
}


//unlike a post
$update;
export function unlike(postId: string): Result<nat, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const hasLiked = post.liked.findIndex(caller => caller.toString() == ic.caller().toString());
            if (hasLiked == -1) {
                return Result.Err<nat, string>(`you haven't liked this post`);
            }
            post.likes = post.likes - 1n;
            post.liked.splice(hasLiked, 1);
            postStorage.insert(post.id, post);
            return Result.Ok<nat, string>(post.likes);
        },
        None: () => Result.Err<nat, string>(`couldn't unlike a post with id=${postId}. post not found`)
    })
}


//disLike a post
$update;
export function disLike(postId: string): Result<nat, string> {
    return match(postStorage.get(postId), {
        Some: (post) => {
            const hasLiked = post.liked.findIndex(caller => caller.toString() === ic.caller().toString());
            const hasDisLiked = post.disliked.findIndex(caller => caller.toString() === ic.caller().toString());


            if(hasLiked ===-1 && hasDisLiked === -1){ //if user has neither liked nor disliked, dislike the post
                post.dislikes = post.dislikes + 1n;
                post.disliked.push(ic.caller());
                postStorage.insert(post.id, post);
                return Result.Ok<nat, string>(post.dislikes);

            } else if( hasLiked === -1 && hasDisLiked !== -1){ //if the user has disliked the post, they cant dislike again
                return Result.Err<nat, string>(`you can't dislike a post twice`);

            }else if(hasLiked !==-1 && hasDisLiked === -1){ //if user had liked before, remove the like and add a dislike
                post.likes = post.likes - 1n;
                post.dislikes = post.dislikes+ 1n;
                post.liked.push(ic.caller());
                post.liked.splice(hasLiked, 1);
                postStorage.insert(post.id, post);
                return Result.Ok<nat, string>(post.likes);
                
            } else{
                return Result.Err<nat, string>(`Something went wrong.`);

            }
        },
        None: () => Result.Err<nat, string>(`couldn't like a post with id=${postId}. post not found`)
    })
}



//get all post by a specific person
$query;
export function getAllPostsByUser(user : string): Result<Vec<Post>,string>{
    const userPosts = postStorage.values().filter((post) => post.author.toString() === user);
    if(userPosts.length <1){
       return Result.Err("No posts by the user found")
    }else{
       return Result.Ok(userPosts)
    }
}

//search post by title or content
$query;
export function searchPost(term : string) : Result<Vec<Post>,string>{

    const postLength = postStorage.len();
    const matchedPosts: Vec<Post> = [];
    const posts = postStorage.items();

    for (let i = 0; i < postLength; i++) {
        const post = posts[Number(i)][1];
        if (
            post.title.toLowerCase().includes(term.toLowerCase()) ||
            post.content.toLowerCase().includes(term.toLowerCase())
        ) {
            matchedPosts.push(post);
        }
    }
    if(matchedPosts.length >0){
        return Result.Ok(matchedPosts)
    }else{
        return Result.Err("No posts with the specified term")
    }
}



//return simple statistics for all the posts in the canister
$query;

export function getStatistics() : Result<Statistics,string>{
    if(postStorage.values().length <1){
        return Result.Err("No user data")
    }

    let stats : Statistics={
        totalPosts : postStorage.values().length,
        uniqueAuthors : allUniqueAuthors(),
        mostLikedPost: highestLikes(),
        mostDisLikedPost: highestDisLikes()
    }

    return Result.Ok(stats);

}

//return post with the highest likes
$query;
 export function highestLikes() : Post{
    const postWithHighestLikes = postStorage.values().reduce((prev, current) => {
        return prev.likes > current.likes ? prev : current;
      });
      return postWithHighestLikes
}

//return post with highest dislikes
$query;
 export function highestDisLikes() : Post{
    const postWithHighestDisLikes = postStorage.values().reduce((prev, current) => {
        return prev.dislikes > current.dislikes ? prev : current;
      });
      return postWithHighestDisLikes
}


//return all the unique authors
$query;
export function allUniqueAuthors() : number{
    var everyPostAuthor : string[] =[];
    for (const post of postStorage.values()) {
        everyPostAuthor.push(post.author.toString())
    }
    let unique   = Array.from(new Set(everyPostAuthor));
    return unique.length

}



// a workaround to make uuid package work with Azle
globalThis.crypto = {
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    }
};
